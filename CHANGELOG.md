# Changelog

All notable changes to `@maindala/telemetry` are documented here. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Backfilled
against the versions actually live on npm
(`npm view @maindala/telemetry versions`/`time`, checked 2026-08-09) — every
version below is confirmed live; none are guessed.

## [0.1.6] - 2026-08-11

### No functional change
Comment- and documentation-only fix, published to obtain a real npm provenance
attestation for this package (attestations only exist on versions published through
the new trusted-publishing workflow — this package has none yet). A source comment in
`src/index.ts` and a line in `DATA.md`'s verification section named an internal service
by its private codename; genericized to "the gateway" — that is the entire diff.
`pushToolCallTelemetry()`'s behavior, request shape, and validation are unchanged from
`0.1.5`. (QFX-2)

Date corrected after the fact (confirmed via `npm view @maindala/telemetry time --json`,
not guessed) — this repo had the identical "published as Unreleased" defect found and
fixed in `@maindala/agent-guard`'s `1.0.1` (this heading was still "Unreleased" while
`0.1.6` was already live on npm). **The published `0.1.6` tarball on npm still contains
this heading as "Unreleased"** — `CHANGELOG.md` ships inside the tarball built at publish
time, and npm versions are immutable, so that copy can never be corrected. Only this repo
copy, and only going forward (via the new `scripts/check-changelog-date.mjs` release
gate — see RELEASING.md), is fixed.

## [0.1.5] - 2026-08-10

### Added
- `DATA.md`: what is stored, where, for how long, and what is provably
  never sent — every claim verified against the real gateway
  implementation, with a round-trip-verified vs. code-verified-only
  distinction for each one. States plainly that this is not an audit
  log and not compliance evidence.
- `examples/self-hosted-sink.mjs`: a ~40-line dependency-free reference
  sink for adopters who cannot send data to the hosted gateway.
- Real test suite (13 vitest tests against a local HTTP server, not a
  mocked fetch): unknown-field dropping, value validation, token never
  in the request body, never-throws.
- This `CHANGELOG.md`.

### No functional change
- `pushToolCallTelemetry()`'s behavior is unchanged from `0.1.4`.

## [0.1.4] - 2026-08-09

### Changed
- No code change. Re-published solely to obtain a correct `gitHead` on the
  published tarball: `0.1.3` had been published with a plain `npm publish`
  from inside the monorepo instead of through `scripts/publish-package.sh`,
  so it carried a `gitHead` pointing at a **private** monorepo commit —
  npm records this on publish and it cannot be edited afterward, so a new
  version was the only fix. `0.1.4` was published the correct way and its
  `gitHead` resolves to a public commit on this package's own repo.

## [0.1.3] - 2026-08-09

### Added
- Value validation for every field `pushToolCallTelemetry` sends —
  `kind`/`decision` enum membership, `toolName`/`target` length caps,
  `findingClasses` array-size and per-entry length caps — mirroring
  the gateway's `validateTelemetryIngestBody()` exactly. Previously the
  client only enforced *which keys* were forwarded (added in `0.1.2`), not
  whether their *values* were within the bounds the server enforces, so an
  out-of-range value (e.g. an 11-entry `findingClasses` array) would reach
  the wire and only be rejected there. An invalid event is now dropped
  client-side with a `console.warn`, before any request is made.

## [0.1.2] - 2026-08-09

### Fixed
- **Critical: the package was never importable.** `0.1.1` shipped with no
  `dist/` directory in the published tarball — `dist/` is gitignored and
  there was no `files` allowlist to override that at publish time, so
  `npm pack` produced a tarball containing only `README.md` and `LICENSE`.
  Every `import { pushToolCallTelemetry } from '@maindala/telemetry'`
  against that version failed. Fixed with an explicit `files` field and a
  `prepublishOnly` build step.
- `pushToolCallTelemetry` now builds its outbound request body by explicitly
  picking the six documented fields off the event you pass in, instead of
  serializing the object as given — a spread (`{ ...internalEvent }`) or an
  untyped caller could otherwise attach an extra property (a prompt, a tool
  result) that would have been forwarded as-is. Unknown fields are now
  dropped client-side with a `console.warn` naming them.

## [0.1.1] - 2026-07-26 — DEPRECATED, never importable

Deprecated on npm (`npm deprecate`) once `0.1.2`'s root cause was
identified. **Do not install this version** — see `0.1.2` above. Added the
README demo GIF and its regeneration instructions; no functional/API change
from `0.1.0`.

## [0.1.0] - 2026-07-25

### Added
- Initial release. `pushToolCallTelemetry(token, event, gatewayUrl?)` — push
  a metadata-only tool-call or A2A-delegation event to mAIndala's free,
  zero-setup `mt_`-token telemetry stream, viewable live with
  `npx maindala tail`. Dependency-free by design; never throws.
