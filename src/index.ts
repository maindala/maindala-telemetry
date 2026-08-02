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
  try {
    await fetch(`${gatewayUrl.replace(/\/$/, '')}/telemetry/ingest`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(event),
    });
  } catch {
    // telemetry loss is acceptable — never throw from this function
  }
}
