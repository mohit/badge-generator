# Badge Generator MCP Server

An MCP (Model Context Protocol) server that allows AI assistants like Claude or ChatGPT to interact with the Badge Generator API to create and manage Open Badges.

## Features

- 🏆 **Create Issuers** - Set up badge-issuing organizations
- 🎖️ **Create Badge Classes** - Define badge types and criteria  
- 📜 **Create Credentials** - Award badges to recipients
- 📋 **List & View Badges** - Browse and inspect created badges
- 🔍 **Public Verification** - Verify badges/issuers without API keys
- 🌐 **Domain Trust Bootstrap** - Verify `.well-known` issuer domains via public or admin routes
- 🔧 **Configuration** - Dynamic server and API key setup

## Installation

1. Install dependencies:
```bash
cd mcp-server
npm install
```

2. Set environment variables:
```bash
export BADGE_BASE_URL="https://your-badge-generator-domain.com"
export BADGE_API_KEY="your_api_key_here" # optional for authenticated tools
```

Or set these variables in your MCP client launch configuration.

## Usage with Claude Desktop

Add this to your Claude Desktop configuration file:

### macOS
`~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows  
`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "badge-generator": {
      "command": "node",
      "args": ["/path/to/badge-generator/mcp-server/index.js"],
      "env": {
        "BADGE_BASE_URL": "https://badges.firmament.works",
        "BADGE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Usage with Other MCP Clients

```bash
# Run the server
node index.js

# Or with development watching
npm run dev
```

## Available Tools

### `test_server`
Test the connection to the Badge Generator server and show current configuration status.

**Example:**
```
Test the server connection and show current status
```

### `configure_server`
Configure connection to your Badge Generator instance (optional if environment variables are set).

**Parameters:**
- `baseUrl` (required) - Badge Generator API URL (e.g., "https://your-domain.com")
- `apiKey` (optional) - API key for authenticated operations

**Example:**
```
Please configure the MCP server to connect to https://your-badge-generator.com
```

**Note:** If you set `BADGE_BASE_URL` and `BADGE_API_KEY` environment variables, this tool becomes optional.

### `create_issuer`
Create a new issuer/organization profile.

**Parameters:**
- `id` (required) - Unique URL identifier
- `name` (required) - Organization name
- `url` (required) - Organization website
- `email` (optional) - Contact email
- `description` (optional) - Organization description
- `image` (optional) - Logo URL

**Example:**
```
Create an issuer for "Acme University" with URL https://acme.edu and email badges@acme.edu
```

### `create_badge_class`
Create a new badge type/achievement.

**Parameters:**
- `id` (required) - Unique URL identifier
- `name` (required) - Badge name
- `description` (required) - What the badge represents
- `criteria` (required) - How to earn the badge
- `issuer` (required) - URL of the issuer
- `image` (optional) - Badge image URL
- `tags` (optional) - Array of tags

**Example:**
```
Create a "Web Development Certificate" badge class for completing advanced web development coursework
```

### `create_credential_subject`
Award a badge to a recipient.

**Parameters:**
- `id` (required) - Unique URL identifier
- `recipient` (required) - Object with type, hashed, and identity
- `badge` (required) - URL of the badge class
- `issuedOn` (optional) - Issue date (ISO 8601)
- `expires` (optional) - Expiration date (ISO 8601)
- `evidence` (optional) - Evidence URL

**Example:**
```
Award the Web Development Certificate to student@example.com with evidence at https://portfolio.example.com
```

### `verify_badge`
Verify a hosted badge URL using public verifier endpoints (no API key required).

### `verify_badge_json`
Verify inline badge JSON using public verifier endpoints (no API key required).

### `verify_issuer`
Verify an issuer profile URL using public verifier endpoints (no API key required).

### `verify_issuer_domain`
Verify a domain’s `.well-known/openbadges-issuer.json`.

**Parameters:**
- `domain` (required) - Domain or URL for issuer verification
- `logTrust` (optional, default `true`) - Persist verified issuer to trust log
- `force` (optional) - Force re-verification (requires API key/admin endpoint)

Behavior:
- With API key: uses admin trust endpoint (`/api/issuers/verify`)
- Without API key: uses public rate-limited trust endpoint (`/public/api/issuers/verify`)

### `validate_issuer_domain`
Validate issuer URL shape locally.

**Parameters:**
- `url` (required) - Issuer URL to validate
- `serverPolicy` (optional) - Also query authenticated server policy endpoint (`/api/validate-issuer-domain`)

### `list_badges`
List all uploaded badge files.

**Example:**
```
Show me all the badges that have been created
```

### `get_badge`  
Retrieve a specific badge file.

**Parameters:**
- `filename` (required) - Name of the badge file

**Example:**
```
Show me the contents of web-dev-badge.json
```

### `sign_badge`
Sign badge JSON using server-managed issuer keys (requires API key).

### `cache_public_key`
Fetch and cache an issuer public key to improve signature verification performance (requires API key).

## Supported Badge Formats

The MCP server supports both Open Badges v2.0 and v3.0 formats:

- **v2.0** - Classic Open Badges (Issuer, BadgeClass, Assertion)
- **v3.0** - Verifiable Credentials format (Profile, Achievement, OpenBadgeCredential)

## Authentication Notes

- **No API key required:** `test_server`, `verify_badge`, `verify_badge_json`, `verify_issuer`, `verify_issuer_domain` (public mode), `get_badge`, local `validate_issuer_domain`
- **API key required:** `create_issuer`, `create_badge_class`, `create_credential_subject`, `list_badges`, `sign_badge`, `cache_public_key`, `verify_issuer_domain` with `force`, `validate_issuer_domain` with `serverPolicy`

## Error Handling

The MCP server provides detailed error messages for:
- Invalid JSON schemas
- API authentication failures
- Network connectivity issues
- Missing required parameters

## Example Workflow

1. **Check server status (optional):**
   ```
   Test the server connection and show current status
   ```

2. **Configure the server (if needed):**
   ```
   Configure the server to use https://your-badge-generator.com
   ```
   
   *Note: Skip this step if you've set environment variables*

3. **Create an issuer:**
   ```
   Create an issuer for "Tech Academy" at https://techacademy.org
   ```

4. **Create a badge class:**
   ```
   Create a "JavaScript Mastery" badge for completing advanced JavaScript coursework
   ```

5. **Award the badge:**
   ```
   Award the JavaScript Mastery badge to developer@email.com
   ```

6. **View the results:**
   ```
   List all badges and show me the JavaScript badge details
   ```

## Development

```bash
# Install dependencies
npm install

# Run with auto-reload
npm run dev

# Test with MCP inspector (if available)
npx @modelcontextprotocol/inspector node index.js
```

## Support

For issues related to:
- MCP server functionality → Check this README
- Badge Generator API → See main project documentation
- Claude Desktop integration → Check Claude Desktop MCP documentation
