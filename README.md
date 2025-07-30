# Badge Generator

A secure web application for hosting Open Badges with password-protected file uploads and API endpoints for creating issuers and badge classes.

## Features

- **Password-protected upload page**: Secure file upload with session-based authentication
- **JSON file hosting**: Upload and host JSON badge files at accessible URLs
- **API endpoints**: Create issuers, badge classes, and credential subjects via API
- **Open Badges v2 compliant**: Follows Open Badges specification

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy the environment configuration:
```bash
cp .env.example .env
```

3. Update the `.env` file with your credentials (random passwords have been generated for you)

4. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## Usage

### Web Interface

1. Navigate to `http://localhost:3000`
2. Login with the password from your `.env` file (`UPLOAD_PASSWORD`)
3. Upload JSON files with optional custom filenames
4. View uploaded files and their public URLs

### API Endpoints

All API endpoints require the `X-API-Key` header with your API key from `.env`.

#### Create Issuer
```bash
POST /api/issuer
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "id": "https://example.com/issuer/1",
  "name": "Example Organization",
  "url": "https://example.com",
  "email": "contact@example.com",
  "description": "An example organization that issues badges",
  "image": "https://example.com/logo.png"
}
```

#### Create Badge Class
```bash
POST /api/badge-class
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "id": "https://example.com/badge/excellence",
  "name": "Excellence Badge",
  "description": "Awarded for demonstrating excellence",
  "image": "https://example.com/badge.png",
  "criteria": "https://example.com/criteria/excellence",
  "issuer": "https://example.com/issuer/1",
  "tags": ["excellence", "achievement"]
}
```

#### Create Credential Subject (Badge Assertion)
```bash
POST /api/credential-subject
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "id": "https://example.com/assertion/123",
  "recipient": {
    "type": "email",
    "hashed": false,
    "identity": "recipient@example.com"
  },
  "badge": "https://example.com/badge/excellence",
  "issuedOn": "2024-01-01T00:00:00Z",
  "evidence": "https://example.com/evidence/123"
}
```

## File Structure

- `server.js` - Main application server
- `uploads/` - Directory for uploaded JSON files (served at `/badges/`)
- `public/` - Static files directory
- `.env` - Environment configuration (not in git)
- `.env.example` - Example environment configuration

## Security

- Upload page is password-protected with session-based authentication
- API endpoints require API key authentication
- Only JSON files are accepted for upload
- Files are validated as proper JSON before storage

## Environment Variables

- `UPLOAD_PASSWORD` - Password for accessing the upload page
- `API_KEY` - API key for creating badges via API
- `PORT` - Server port (default: 3000)

## MCP Server Integration

This project includes an MCP (Model Context Protocol) server that allows AI assistants like Claude or ChatGPT to interact with your Badge Generator API.

### Setup MCP Server

1. Install MCP server dependencies:
```bash
cd mcp-server
npm install
```

2. Configure Claude Desktop by adding to your config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "badge-generator": {
      "command": "node",
      "args": ["/absolute/path/to/badge-generator/mcp-server/index.js"],
      "env": {
        "BADGE_API_KEY": "hJOvxkppmwJnTRoreFwprv59SY5YeWr+vRslC7Ytg4M="
      }
    }
  }
}
```

### Available MCP Tools

- `configure_server` - Set up API connection
- `create_issuer` - Create badge-issuing organizations
- `create_badge_class` - Define badge types and criteria
- `create_credential_subject` - Award badges to recipients
- `create_smart_badge` - Process complete badge systems
- `list_badges` - Browse created badges
- `get_badge` - Retrieve specific badge files

See `mcp-server/README.md` for detailed usage instructions.

## Generated Credentials

Your `.env` file contains randomly generated secure credentials:
- Upload password: `6rEt1xwM4ZalpuPoqPRaUuVtaWknb7eYbS5644nylHs=`
- API key: `hJOvxkppmwJnTRoreFwprv59SY5YeWr+vRslC7Ytg4M=`