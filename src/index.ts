// @maindala/telemetry — free, zero-setup live telemetry for AI agents.
//
// This is a deliberately thin, standalone package: it does ONE thing (push a
// metadata-only tool-call event to mAIndala's free telemetry stream) and has no
// dependency on — or awareness of — the fuller @maindala/agent-guard governance
// SDK (policy enforcement, DLP, org auth). That SDK's pushToolCallTelemetry method
// implements the identical wire contract; this package exists as its own narrow,
// open-source surface so adopting live observability never requires taking on
// org/governance setup. Get a free token with `npx maindala tail --signup
// you@example.com`, then call pushToolCallTelemetry() after any tool call your
// agent makes. Never throws — telemetry loss is always preferable to breaking
// the agent it's observing.
//
// Metadata-only, by construction: this module has no field for prompts, tool
// arguments, or tool results, and never will. Only what ran, where, how long it
// took, and (if you're also using mAIndala governance) the policy decision.

export interface ToolCallTelemetryEvent {
  /** "tool_call" for an MCP/tool invocation, "a2a_call" for an agent-to-agent delegation. */
  kind: 'tool_call' | 'a2a_call';
  /** The tool or delegation name that ran, e.g. "send_email" or "call_agent". */
  toolName: string;
  /** What it targeted — a service slug, hostname, or callee agent slug. */
  target: string;
  /** How long the call took, in milliseconds. */
  latencyMs?: number;
  /** A governance decision, if one applies. Omit if you're not using policy enforcement. */
  decision?: 'allow' | 'deny' | 'redact' | 'flag' | 'observed';
  /** Class names only (e.g. "secret_egress") — never matched content. */
  findingClasses?: string[];
}

const DEFAULT_GATEWAY_URL = 'https://mcp.maindala.com';

// Validation limits, mirrored from the gateway's validateTelemetryIngestBody()
// — that function is the source of truth for the wire contract. They're
// duplicated rather than imported because this package is deliberately
// standalone and dependency-free (that's its whole design point), matching the
// per-package-duplication convention used elsewhere in this codebase. If the
// gateway's limits change, change them here too.
const KINDS = ['tool_call', 'a2a_call'] as const;
const DECISIONS = ['allow', 'deny', 'redact', 'flag', 'observed'] as const;
const MAX_STRING_FIELD_LEN = 200;
const MAX_FINDING_CLASSES = 10;
const MAX_FINDING_CLASS_LEN = 50;

// Returns an error string describing the first rule the event breaks, or null
// if it's valid. Checks the VALUES of the allowed fields — the field allowlist
// below only controls which keys are forwarded, so without this an untyped JS
// caller or a spread could still put arbitrary-length arbitrary content into
// `findingClasses`, `toolName`, etc. and it would reach the wire before the
// server's own allowlist rejected it. Validating here is what makes the
// metadata-only guarantee true at the value level, not just the key level.
function validateEvent(event: ToolCallTelemetryEvent): string | null {
  if (!KINDS.includes(event.kind)) {
    return `\`kind\` must be one of: ${KINDS.join(', ')}`;
  }
  for (const field of ['toolName', 'target'] as const) {
    const value = event[field];
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_STRING_FIELD_LEN) {
      return `\`${field}\` must be a non-empty string up to ${MAX_STRING_FIELD_LEN} chars`;
    }
  }
  if (event.latencyMs !== undefined) {
    if (typeof event.latencyMs !== 'number' || !Number.isFinite(event.latencyMs) || event.latencyMs < 0) {
      return '`latencyMs` must be a non-negative finite number';
    }
  }
  if (event.decision !== undefined && !DECISIONS.includes(event.decision)) {
    return `\`decision\` must be one of: ${DECISIONS.join(', ')}`;
  }
  if (event.findingClasses !== undefined) {
    if (!Array.isArray(event.findingClasses) || event.findingClasses.length > MAX_FINDING_CLASSES) {
      return `\`findingClasses\` must be an array of at most ${MAX_FINDING_CLASSES} strings`;
    }
    for (const c of event.findingClasses) {
      if (typeof c !== 'string' || c.length === 0 || c.length > MAX_FINDING_CLASS_LEN) {
        return `\`findingClasses\` entries must be non-empty strings up to ${MAX_FINDING_CLASS_LEN} chars (class names only, never matched content)`;
      }
    }
  }
  return null;
}

/**
 * Pushes a single metadata-only tool-call/A2A-delegation event to your free
 * mAIndala telemetry stream. Fire-and-forget: never throws, so a network hiccup
 * or an expired token can never break the agent run you're observing.
 *
 * @param token   Your mt_ telemetry token — get one free with
 *                `npx maindala tail --signup you@example.com` (no account needed).
 * @param event   The event to push. Metadata only — see ToolCallTelemetryEvent.
 * @param gatewayUrl  Override the mAIndala gateway URL (default: https://mcp.maindala.com).
 */
export async function pushToolCallTelemetry(
  token: string,
  event: ToolCallTelemetryEvent,
  gatewayUrl: string = DEFAULT_GATEWAY_URL,
): Promise<void> {
  // Build the outbound body by explicitly picking the known fields, rather
  // than serializing `event` as-is. TypeScript's structural typing only
  // constrains callers at compile time — it does not stop a spread
  // (`{ ...internalEvent }`) or an untyped JS caller from attaching extra
  // properties, and JSON.stringify would forward whatever is actually
  // present on the object at runtime. This is what makes the metadata-only
  // guarantee true by construction on the client, rather than depending on
  // the server's own allowlist to catch what shouldn't have been sent.
  const safeEvent: ToolCallTelemetryEvent = {
    kind:     event.kind,
    toolName: event.toolName,
    target:   event.target,
    ...(event.latencyMs !== undefined ? { latencyMs: event.latencyMs } : {}),
    ...(event.decision !== undefined ? { decision: event.decision } : {}),
    ...(event.findingClasses !== undefined ? { findingClasses: event.findingClasses } : {}),
  };
  const droppedKeys = Object.keys(event).filter(
    (k) => !['kind', 'toolName', 'target', 'latencyMs', 'decision', 'findingClasses'].includes(k),
  );
  if (droppedKeys.length > 0) {
    console.warn(`[@maindala/telemetry] dropped non-metadata field(s) before sending: ${droppedKeys.join(', ')}`);
  }

  // Reject the whole event rather than salvaging the valid fields: the server
  // rejects the entire request, so anything less would leave client and server
  // disagreeing about what a valid event is — which is the defect this fixes.
  // Warn and return; never throw. Callers run this inside their own agent loop
  // and the never-throws contract above is load-bearing.
  const invalid = validateEvent(safeEvent);
  if (invalid) {
    console.warn(`[@maindala/telemetry] event not sent — ${invalid}`);
    return;
  }

  try {
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/telemetry/ingest`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(safeEvent),
    });
    if (!res.ok) {
      console.warn(`[@maindala/telemetry] event was not accepted (HTTP ${res.status}) — it was not delivered`);
    }
  } catch {
    // telemetry loss is acceptable — never throw from this function
  }
}
