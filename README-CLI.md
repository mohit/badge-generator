# Badge CLI Tool

A command-line interface for managing Open Badges issuers, verification, and badge creation with the Badge Generator platform.

## Installation

```bash
# Install dependencies
npm install

# Make CLI executable
chmod +x cli/badge-cli.js

# Test installation
node cli/badge-cli.js --help
```

## Quick Start

### 1. Configure the CLI

```bash
# Set your API key
node cli/badge-cli.js config --api-key "your-api-key-here"

# Test connection
node cli/badge-cli.js test-connection
```

### 2. Validate a Domain

```bash
# Check if a domain is valid for badge issuing
node cli/badge-cli.js validate "https://demo.example.org/issuer"
```

### 3. Create an Issuer

```bash
# Create a new badge issuer
node cli/badge-cli.js create-issuer \
  --name "Demo University" \
  --url "https://demo.example.org" \
  --email "badges@demo.example.org" \
  --description "Official issuer for Demo University"
```

### 4. Create a Badge Class

```bash
# Create a new badge class
node cli/badge-cli.js create-badge \
  --name "Web Development Certificate" \
  --description "Completed comprehensive web development course" \
  --issuer "https://demo.example.org/issuer/1" \
  --criteria "Complete all 12 modules and final project"
```

## Commands Reference

### Configuration

#### `config`
Configure CLI settings.

```bash
# Set API key
node cli/badge-cli.js config --api-key "your-key"

# Set custom base URL
node cli/badge-cli.js config --base-url "https://your-instance.com"

# Show current configuration
node cli/badge-cli.js config --show
```

### Domain Validation

#### `validate <url>`
Validate an issuer domain for compliance and security.

```bash
node cli/badge-cli.js validate "https://example.com/issuer"
```

**Response Types:**
- `verified` - Our verified issuer (production ready)
- `testing` - Safe testing domains (example.com variants)
- `blocked` - Real domains without verification
- `invalid` - Invalid URL format

### Issuer Management

#### `create-issuer`
Create a new badge issuer.

```bash
node cli/badge-cli.js create-issuer \
  --name "Organization Name" \
  --url "https://org.example.com" \
  --email "contact@org.example.com" \
  --description "Optional description"
```

**Required Options:**
- `-n, --name <name>` - Organization name
- `-u, --url <url>` - Organization website URL  
- `-e, --email <email>` - Contact email

**Optional Options:**
- `-d, --description <desc>` - Organization description

### Badge Creation

#### `create-badge`
Create a new badge class.

```bash
node cli/badge-cli.js create-badge \
  --name "Certificate Name" \
  --description "What this badge represents" \
  --issuer "https://demo.example.org/issuer/1" \
  --criteria "How to earn this badge"
```

**Required Options:**
- `-n, --name <name>` - Badge name
- `-d, --description <desc>` - Badge description
- `-i, --issuer <url>` - Issuer URL

**Optional Options:**
- `-c, --criteria <criteria>` - Earning criteria

### Verification & Keys

#### `generate-keys`
Generate cryptographic keys and verification files for organizations.

```bash
node cli/badge-cli.js generate-keys \
  --name "University Name" \
  --url "https://university.edu" \
  --email "badges@university.edu" \
  --description "Official university badge issuer"
```

**Output Files (in `./issuer-verification-files/`):**
- `issuer.json` - Host at `/.well-known/issuer.json`
- `private-key.pem` - Keep secure for signing
- `public-key.pem` - Public verification key

#### `verify <domain>`
Verify an issuer domain that hosts a well-known file.

```bash
node cli/badge-cli.js verify "university.edu"
```

#### `get-issuer <domain>`
Get information about a verified issuer.

```bash
node cli/badge-cli.js get-issuer "university.edu"
```

### Testing

#### `test-connection`
Test connection to the badge API.

```bash
node cli/badge-cli.js test-connection
```

## Domain Validation Rules

### ✅ Allowed Domains

**Verified Domains:**
- `badge-generator-production.up.railway.app` - Our verified issuer

**Testing Domains:**
- `example.com`, `example.org`, `example.net`
- `demo.example.org`, `test.example.com`
- `localhost`, `127.0.0.1`

### ❌ Blocked Domains

- Real registered domains without verification
- Examples: `harvard.edu`, `microsoft.com`, `google.com`

## Organization Verification Guide

To become a verified issuer for your real domain:

### Step 1: Generate Verification Files

```bash
node cli/badge-cli.js generate-keys \
  --name "Your Organization" \
  --url "https://yourdomain.com" \
  --email "badges@yourdomain.com"
```

### Step 2: Host the Well-Known File

Upload `issuer.json` to your website at:
```
https://yourdomain.com/.well-known/issuer.json
```

### Step 3: Verify Your Domain

```bash
node cli/badge-cli.js verify "yourdomain.com"
```

### Step 4: Create Badges

Once verified, you can create issuers and badges:

```bash
node cli/badge-cli.js create-issuer \
  --name "Your Organization" \
  --url "https://yourdomain.com" \
  --email "badges@yourdomain.com"
```

## Error Handling

### Common Errors

**"API key not configured"**
```bash
node cli/badge-cli.js config --api-key "your-key"
```

**"Domain appears to be registered"**
- Use `example.com` domains for testing
- Or complete domain verification process

**"Connection failed"**
- Check your internet connection
- Verify the base URL is correct
- Check API key is valid

## Security Best Practices

1. **Keep private keys secure** - Never share `private-key.pem`
2. **Use HTTPS** - Always use secure URLs
3. **Verify domains** - Complete verification for production use
4. **Test first** - Use example.com domains for testing

## Examples

### Complete Workflow: Testing

```bash
# Configure CLI
node cli/badge-cli.js config --api-key "your-key"

# Create test issuer
node cli/badge-cli.js create-issuer \
  --name "Demo College" \
  --url "https://demo.example.org" \
  --email "test@demo.example.org"

# Create test badge
node cli/badge-cli.js create-badge \
  --name "Programming Basics" \
  --description "Completed introduction to programming" \
  --issuer "https://demo.example.org/issuer/1"
```

### Complete Workflow: Production

```bash
# Generate verification files
node cli/badge-cli.js generate-keys \
  --name "Real University" \
  --url "https://university.edu" \
  --email "badges@university.edu"

# Host issuer.json at https://university.edu/.well-known/issuer.json

# Verify domain
node cli/badge-cli.js verify "university.edu"

# Create production issuer
node cli/badge-cli.js create-issuer \
  --name "Real University" \
  --url "https://university.edu" \
  --email "badges@university.edu"
```

## Integration with Claude/MCP

The Badge Generator also provides an MCP (Model Context Protocol) server for integration with Claude Desktop.

### MCP Configuration

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "badge-generator": {
      "command": "node",
      "args": ["/path/to/badge-generator/mcp-server/index.js"],
      "env": {
        "BADGE_API_BASE_URL": "https://badge-generator-production.up.railway.app",
        "BADGE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Using with Claude

Once configured, you can ask Claude to:

```
Create a badge for completing a Python course from Demo University
```

Claude will use the MCP server to:
1. Validate the domain
2. Create the issuer if needed
3. Create the badge class
4. Show warnings about domain types

## Support

For issues and questions:
- Check domain validation rules
- Verify API key configuration
- Test connection first
- Use example.com domains for testing

## License

MIT License - see LICENSE file for details.