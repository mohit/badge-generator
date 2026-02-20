# Badge Generator

A secure, deployable web application for hosting Open Badges with password-protected file uploads, comprehensive verification system, and API endpoints for creating issuers and badge classes.

## 📚 Documentation

- **[CLI Documentation](README-CLI.md)** - Command-line interface for badge operations and verification
- **[Claude Integration Guide](README-CLAUDE-INTEGRATION.md)** - Using Badge Generator with Claude Desktop via MCP
- **[Deployment Guide](DEPLOYMENT.md)** - Comprehensive deployment instructions for all platforms
- **[Domain Validation](DOMAIN_VALIDATION.md)** - Understanding domain verification and security
- **[Our Vision](public/vision.html)** - The long-term vision for democratizing digital credentials

## Features

- **Password-protected upload page**: Secure file upload with session-based authentication
- **JSON file hosting**: Upload and host JSON badge files at accessible URLs
- **Badge verification system**: Cryptographic signature verification and issuer validation
- **API endpoints**: Create issuers, badge classes, and credential subjects via API
- **Open Badges v2 & v3 compliant**: Follows Open Badges specification
- **Multi-platform deployment**: Deploy anywhere with Docker, cloud platforms, or self-hosted
- **CLI tools**: Command-line interface for badge operations and verification
- **MCP integration**: AI assistant integration via Model Context Protocol

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Copy the environment configuration:**
```bash
cp .env.example .env
```

3. **Update the `.env` file** with your credentials and domain

4. **Start the server:**
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## Deployment

This application can be deployed on any platform. See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive deployment guides including:

- **Docker**: containerized deployment with docker-compose
- **Railway**: one-click deployment
- **Heroku**: git-based deployment
- **DigitalOcean**: droplet or app platform
- **Self-hosted**: traditional server deployment
- **Other platforms**: Vercel, Netlify, AWS, etc.

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

### Required
- `PUBLIC_DOMAIN` - Your domain (e.g., "yourdomain.com" or "localhost:3000")
- `UPLOAD_PASSWORD` - Password for accessing the upload page
- `API_KEY` - API key for creating badges via API
- `DEFAULT_PRIVATE_KEY` - Base64-encoded Ed25519 private key for signing
- `DEFAULT_PUBLIC_KEY` - Base64-encoded Ed25519 public key for verification

### Optional
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

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
        "BADGE_API_KEY": "your_api_key_from_env_file"
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
- `list_badges` - Browse created badges
- `get_badge` - Retrieve specific badge files

See `mcp-server/README.md` for detailed usage instructions.

## Generated Credentials

Your `.env` file contains randomly generated secure credentials. Check the `.env` file for your specific credentials:
- Upload password: Found in `UPLOAD_PASSWORD` 
- API key: Found in `API_KEY`

**⚠️ Security Note:** Never commit your `.env` file or share these credentials publicly.
