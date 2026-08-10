// Dev-only test helper — a minimal real HTTP server used by the vitest suite to
// exercise pushToolCallTelemetry() against genuine network behavior (a real
// response, a captured request body/header, a request-count assertion) rather
// than a mocked fetch. Excluded from both the published dist (tsconfig) and the
// runtime `dependencies` (uses only Node's built-in `http` module, so it adds no
// dependency, dev or otherwise, beyond what's already required to run Node at
// all — keeping this package's zero-`dependencies` property intact even in test
// code). Deliberately duplicated from `packages/agent-guard/src/stub-http-server.ts`
// rather than shared, matching this repo's per-package-duplication convention for
// small standalone tooling.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface StubServer {
  url:           string;
  requestCount:  () => number;
  bodies:        () => string[];
  close:         () => Promise<void>;
}

// Starts a server whose behavior is fully controlled by `handler`, called once
// per completed request with the 0-based index of that request. Tracks every
// inbound request (count + raw body) so tests can assert exactly how many times
// pushToolCallTelemetry actually hit the network, and what it sent.
export function startStubServer(
  handler: (req: IncomingMessage, res: ServerResponse, requestIndex: number) => void,
): Promise<StubServer> {
  let count = 0;
  const bodies: string[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      bodies.push(body);
      const index = count;
      count += 1;
      handler(req, res, index);
    });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url:          `http://127.0.0.1:${port}`,
        requestCount: () => count,
        bodies:       () => bodies,
        close:        () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
