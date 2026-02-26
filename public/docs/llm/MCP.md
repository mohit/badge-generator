# MCP Integration (LLM)

This project includes an MCP server at `mcp-server/index.js`.

## Purpose

Expose badge operations to LLM clients (for example Claude Desktop) through tool calls.

## Minimal Claude Desktop Config

```json
{
  "mcpServers": {
    "badge-generator": {
      "command": "node",
      "args": ["/absolute/path/to/badge-generator/mcp-server/index.js"],
      "env": {
        "BADGE_BASE_URL": "https://badges.firmament.works",
        "BADGE_API_KEY": "<API_KEY>"
      }
    }
  }
}
```

## Typical Tool Capabilities

- Configure and test server connection
- Validate issuer domains
- Create issuer, badge class, credential subject
- Verify badge and issuer resources
- List and fetch hosted badge files
- Generate issuer profile templates (`generate_issuer_profile_template`)
- Issue signed sample badges via public demo API (`issue_sample_badge`)
- Explain verifier JSON in plain language (`explain_verification_result`)

## Operational Guidance

1. Use testing domains (`example.com` variants) for demos.
2. For real domains, publish `/.well-known/openbadges-issuer.json` first.
3. Keep `BADGE_API_KEY` scoped and rotate regularly.
4. Prefer public verification endpoints for untrusted user-provided URLs.
