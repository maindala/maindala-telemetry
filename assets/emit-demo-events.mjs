// Demo-capture emitter for assets/demo.tape — NOT part of the published package.
// Pushes real, metadata-only events to the live ingest endpoint (matches
// pushToolCallTelemetry's exact wire contract) so the GIF captures a genuine
// live stream, not faked/hand-typed terminal lines. Timed to land while
// `maindala tail` is running during the vhs recording.
//
// Reads MAINDALA_API_KEY — the SAME env var `maindala tail` itself reads
// (see packages/cli's getApiKey()) — so re-rendering only needs ONE exported
// token, never typed or shown on screen. Use a throwaway mt_ token from
// `maindala tail --signup <email>`, never a real project's.

const token = process.env.MAINDALA_API_KEY;
if (!token) {
  console.error('MAINDALA_API_KEY env var is required (a throwaway mt_ token)');
  process.exit(1);
}

const GATEWAY_URL = 'https://mcp.maindala.com';

async function push(event) {
  await fetch(`${GATEWAY_URL}/telemetry/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(event),
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const events = [
  { kind: 'tool_call', toolName: 'web_search', target: 'serper', latencyMs: 312, decision: 'allow' },
  { kind: 'tool_call', toolName: 'send_email', target: 'gmail', latencyMs: 41, decision: 'deny' },
  { kind: 'tool_call', toolName: 'read_file', target: 'filesystem', latencyMs: 8, decision: 'flag', findingClasses: ['secret_egress'] },
  { kind: 'a2a_call', toolName: 'call_agent', target: 'billing-agent', latencyMs: 894, decision: 'allow' },
  { kind: 'tool_call', toolName: 'create_order', target: 'stripe', latencyMs: 156, decision: 'allow' },
];

for (const event of events) {
  await push(event);
  await sleep(1400);
}
