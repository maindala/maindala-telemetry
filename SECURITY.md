# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in `@maindala/telemetry`, please
report it privately rather than opening a public issue.

**Contact:** it@maindala.com

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce, or a minimal proof-of-concept.
- The package version(s) affected.

We will acknowledge your report within **3 business days** and aim to provide an initial
assessment (confirmed / not applicable / needs more information) within **10 business days**.
If confirmed, we will work with you on a disclosure timeline and credit you in the release
notes unless you prefer to remain anonymous.

Please do not publicly disclose the issue until a fix has been released.

## Supported versions

`@maindala/telemetry` follows semantic versioning; it has not yet reached 1.0. Only the
latest published version receives fixes.

| Version | Supported |
|---|---|
| 0.1.5 | ✅ |
| 0.1.4 | ❌ |
| 0.1.3 | ❌ |
| 0.1.2 | ❌ |
| 0.1.1 | ❌ (deprecated on npm — shipped with no `dist/`, never importable) |
| 0.1.0 | ❌ |

## Scope

This package sends metadata-only events to a gateway you configure (`gatewayUrl`, default the
mAIndala-hosted gateway). See [DATA.md](./DATA.md) for exactly what is collected, where, and
for how long. A report about the hosted gateway itself (as opposed to this package's code)
should also go to it@maindala.com — we will route it internally.
