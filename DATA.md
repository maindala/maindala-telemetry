# Data handling — `@maindala/telemetry`

This document describes exactly what the free mAIndala telemetry service
stores, where, for how long, and what it provably never receives. Every claim
below was checked against the live implementation of the gateway's
`/telemetry/ingest` and `/telemetry/stream` routes and their Redis usage, plus
the signup/token-validation routes behind them — not inferred from this
package's README or from aspiration. Where a claim is
observable at runtime, it was also proven with a real local round trip
(signup → ingest → inspect the Redis key directly), not just read from source.
See "Verification" at the end for exactly what was run.

This document covers only the `mt_` zero-setup free-tier path this package
talks to (`pushToolCallTelemetry` → `POST /telemetry/ingest`). It does not
describe `@maindala/agent-guard`'s separate `mx_` org-gateway broker or its
audit log — different token family, different table, different retention,
and out of scope for this package.

## What is collected

Two independent things happen, on two different systems:

**1. The event you push.** Exactly the fields in `ToolCallTelemetryEvent`:
`kind`, `toolName`, `target`, and optionally `latencyMs`, `decision`,
`findingClasses`. Nothing else — see "What is provably never sent" below.

**2. Your signup identity**, created once via `maindala tail --signup
<email>` (or `POST /telemetry-signup` directly): an email address and an
optional display name. This is deliberately *not* a full account — no
password, no session, no org membership. It exists only so the free tier
isn't fully anonymous.

## Where it lives, and for how long

| Data | Store | Retention |
|---|---|---|
| Pushed events (`kind`/`toolName`/`target`/…) | Redis, per-project ring buffer, key `telemetry:<projectId>` | **Capped at 500 events, expires after 1 hour (`EXPIRE`, refreshed on every write) — whichever comes first.** Round-trip verified (see below). |
| Signup identity (email, name) | Postgres (`telemetry_projects` table) | **No expiry.** The row persists until manually deleted — there is no automated purge job and no self-service deletion endpoint in the codebase today. |
| Your `mt_` token | Postgres (`telemetry_tokens` table) | Only a SHA-256 hash and an 8-character prefix are stored, matching every other key family in this system (`mk_`/`mx_`). The plaintext token is shown once, at signup, and never stored or recoverable — losing it means signing up again. The table has a `revoked` column the validator already checks, but no route in the codebase sets it — **token revocation is not currently self-service.** |

Both Postgres and Redis run in **`us-west1`** (the platform's single GCP
region — verified against the platform's own infrastructure config, which
both the Cloud SQL and Memorystore resources reference).

The ring buffer is genuinely ephemeral, not "ephemeral until someone forgets
to delete it": `pushTelemetryEvent()` calls `RPUSH` then `LTRIM
telemetry:<projectId> -500 -1` then `EXPIRE telemetry:<projectId> 3600` on
every single write, so the cap and TTL are enforced on the write path itself,
not by a separate cleanup job that could fall behind or fail silently.

## Isolation between projects

Every event is written to and read from a Redis key scoped to the
authenticated token's own `projectId` — `readTelemetryEvents()` only ever
reads `telemetry:<projectId>` for the project the presented token resolved
to. A second project's token cannot see, and was confirmed (round trip, see
below) to see zero of, another project's events.

## What is provably never sent

The event shape (`ToolCallTelemetryEvent`) has no field for a prompt, a tool
argument, or a tool result — there is nowhere to put one. This is enforced
twice, independently:

- **Client-side**, in this package: `pushToolCallTelemetry()` builds the
  outbound body by explicitly picking the six known fields off the event you
  pass in, rather than serializing the object as given — a spread or an
  untyped caller attaching an extra property is dropped (with a
  `console.warn`) before anything is sent, not filtered server-side after the
  fact.
- **Server-side**, in the gateway: `validateTelemetryIngestBody()`
  rejects the *entire request* with `400` if it contains any key outside the
  same six-field allowlist, and separately validates every field's value
  (enum membership, string length caps, array size caps) — even a caller that
  bypassed this package entirely and POSTed to the endpoint directly cannot
  get an unlisted field, or an oversized one, accepted.

`findingClasses` is class names only (e.g. `"secret_egress"`) by the same
double enforcement — never the text that matched.

The `mt_` token itself travels only in the `Authorization: Bearer` header,
never in the JSON body — proven both by this package's own test suite
(`src/index.test.ts`, "the token never appears in the request body") and by
the reference-sink round trip below.

The gateway does not log request bodies (no access-log/body-logging
middleware is registered on its Express app); on a Redis failure it logs only
the error message, never the event content or the token
(`pushTelemetryEvent`'s catch block).

## Deletion

There is no self-service "delete my data" endpoint today, for either the
Redis event data or the Postgres signup identity:

- **Event data** requires no action — it is gone on its own within an hour of
  your last push (or sooner, once you're past 500 events since your last
  poll), by the ring-buffer mechanism above.
- **Your email/name/token row** persists indefinitely in Postgres until
  manually removed. If you want it deleted, contact `it@maindala.com` — this
  is a manual, human-handled deletion today, not an automated one.

## Not an audit log, not compliance evidence

This is a live-observability convenience, not a durable record. The event
data self-destructs within an hour by design; there is no immutable,
tamper-evident, long-retention store behind it, and nothing here is signed or
timestamped for evidentiary purposes. If what you need is a signed,
retained, framework-mapped export for an auditor — EU AI Act, NIST AI RMF, or
SOC 2 controls — that is a distinct, purpose-built capability: **Compliance
Evidence Packs** (part of the hosted mAIndala platform, not this package).
Do not point an auditor at `maindala tail` or this package's data path as
evidence of anything.

## Self-hosted sink

If sending data to mAIndala's hosted gateway doesn't clear your bar at all —
not even the ephemeral, metadata-only path above — `pushToolCallTelemetry`'s
third argument already lets you point at your own endpoint instead:

```ts
await pushToolCallTelemetry(token, event, 'https://your-own-sink.example.com');
```

Your code owns the sink from that point on — nothing leaves your
infrastructure. `examples/self-hosted-sink.mjs` in this package is a working,
~30-line, dependency-free reference: a plain `node:http` server that accepts
`POST /telemetry/ingest` and logs what it received. Run it, point
`gatewayUrl` at it, and you have your own private telemetry endpoint:

```bash
node examples/self-hosted-sink.mjs
# in your agent's code:
# pushToolCallTelemetry(token, event, 'http://localhost:4317')
```

The reference sink does not implement authentication or storage — it is a
starting point, not a production sink. A real self-hosted deployment should
add its own token check (the `Authorization` header is already there to
check) and its own persistence.

## Verification

Run locally against local dev infrastructure (`docker compose` Postgres +
Redis, real `catalog-service` and `mcp-gateway` processes) on 2026-08-09:

- **Round-trip verified**: a real `POST /telemetry-signup` → `POST
  /telemetry/ingest` → direct `redis-cli LRANGE`/`TTL`/`LLEN` inspection
  confirmed the stored event shape, a TTL of exactly 3600 seconds refreshed
  on write, and — by pushing 504 events through the real rate-limited
  endpoint — the ring buffer capping at exactly 500 entries via true FIFO
  eviction (the oldest surviving entry was the 5th event pushed, not the
  1st–4th, and the newest was the very last one pushed). Also verified: a
  second project's token receives zero events from the first project's
  buffer (cross-project isolation); a malformed/garbage/wrong-token-family
  (`mx_`) credential is rejected with `401`; a request carrying a field
  outside the allowlist is rejected with `400` and never reaches Redis at
  all (`LLEN` unchanged).
- **Round-trip verified**: the reference self-hosted sink
  (`examples/self-hosted-sink.mjs`) was run for real, and a real event pushed
  to it via the built package arrived with exactly the metadata-only fields
  and no token anywhere in the received body.
- **Code-verified only** (not independently re-run against live production,
  since it requires infra access this session didn't have): the `us-west1`
  region claim (read from the platform's own infrastructure config), and that
  no purge job or deletion route exists anywhere in the codebase for the
  signup-project/token tables (verified by an exhaustive source grep, not by
  observing an absence over time in production).
