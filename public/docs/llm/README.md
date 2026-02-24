# Badge Generator LLM Docs

This directory is a markdown-only documentation surface for LLMs and automation agents.

Use this order:

1. Read [API.md](./API.md) for endpoint behavior.
2. Read [DEPLOYMENT.md](./DEPLOYMENT.md) for runtime and environment setup.
3. Read [CLI.md](./CLI.md) for command-line workflows.
4. Read [MCP.md](./MCP.md) for Claude Desktop / MCP usage.

## Scope

- Issuer creation and hosting
- Badge class creation
- Credential subject (assertion) creation
- Cryptographic signing
- Badge and issuer verification
- Domain verification and impersonation prevention

## Notes

- These docs are intentionally concise and markdown-only.
- Public verification endpoints are under `/public/api/*` and include SSRF protections.
- Authenticated write and admin endpoints are under `/api/*` and require `X-API-Key`.
