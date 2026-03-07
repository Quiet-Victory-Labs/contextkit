# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.4.x   | :white_check_mark: |
| 0.3.x   | :x:                |
| < 0.3   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email **security@contextkit.dev** with details
3. Include steps to reproduce if possible

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Scope

ContextKit runs locally and connects to databases using credentials you provide. The `context serve` MCP server binds to localhost by default. If you use `--host 0.0.0.0` to expose it to the network, ensure your environment is secured appropriately.
