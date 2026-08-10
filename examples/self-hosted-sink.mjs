#!/usr/bin/env node
// Reference self-hosted sink for @maindala/telemetry (OAE-13). Demonstrates the
// custom-`gatewayUrl` path pushToolCallTelemetry() already supports: point it at
// this server instead of the hosted https://mcp.maindala.com default, and events
// never leave your own infrastructure. Deliberately minimal — no auth, no
// storage, no dependencies — a real deployment should add its own token check
// and persistence; this is the ~30-line shape that proves the path works.
import { createServer } from 'node:http';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4317;

const server = createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/telemetry/ingest') {
    res.writeHead(404).end();
    return;
  }
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let event;
    try {
      event = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'invalid JSON' }));
      return;
    }
    // The mt_ token travels ONLY in the Authorization header — pushToolCallTelemetry
    // never puts it in the body, so a real sink can log/store `event` as-is with
    // no risk of persisting a credential alongside it.
    //
    // The header itself is a different matter: it IS the credential, so it is
    // truncated before it reaches the log. Copy this habit rather than the
    // obvious `console.log(req.headers.authorization)` — a prior release of the
    // mAIndala CLI printed a full mt_ token to the terminal and an external
    // audit rightly flagged it. An example is the thing people paste, so it has
    // to model the safe pattern, not just describe it.
    const auth = req.headers['authorization'];
    const authLabel = auth ? `${auth.slice(0, 14)}…(truncated)` : '(no auth header)';
    console.log(`[sink] event via ${authLabel}:`, event);
    res.writeHead(202, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
  });
});

server.listen(PORT, () => {
  console.log(`Self-hosted telemetry sink listening on http://localhost:${PORT}`);
  console.log(`Point pushToolCallTelemetry's gatewayUrl at: http://localhost:${PORT}`);
});
