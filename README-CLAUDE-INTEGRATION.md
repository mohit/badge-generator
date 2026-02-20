# Using Badge Generator with Claude Desktop

This guide shows how to integrate the Badge Generator platform with Claude Desktop using the Model Context Protocol (MCP) for seamless badge creation and management.

## Overview

The Badge Generator MCP server allows Claude to:
- ✅ Create and manage badge issuers
- ✅ Create badge classes and credentials
- ✅ Validate domains for security
- ✅ Handle issuer verification
- ✅ Generate cryptographic keys
- ✅ Access hosted badge files

## Quick Setup

### 1. Get Your API Key

Contact the Badge Generator platform administrator and use your own API key:
```
<YOUR_BADGE_API_KEY>
```

### 2. Configure Claude Desktop

Add this to your Claude Desktop MCP configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "badge-generator": {
      "command": "node",
      "args": ["/path/to/badge-generator/mcp-server/index.js"],
      "env": {
        "BADGE_API_BASE_URL": "https://your-badge-generator-domain.com",
        "BADGE_API_KEY": "<YOUR_BADGE_API_KEY>"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

Restart Claude Desktop to load the MCP server.

### 4. Test the Integration

Ask Claude:
```
Test the badge generator connection and show me what tools are available
```

## Usage Examples

### Basic Badge Creation

**Ask Claude:**
```
Create a badge for "JavaScript Fundamentals" from Demo University at demo.example.org. 
The badge should be for completing a 40-hour JavaScript course.
```

**Claude will:**
1. Validate the domain (demo.example.org = safe for testing)
2. Create the issuer "Demo University"
3. Create the badge class "JavaScript Fundamentals"
4. Show you the hosted URLs
5. Display any domain warnings

### Domain Validation

**Ask Claude:**
```
Check if I can create badges for harvard.edu
```

**Claude will:**
1. Validate the domain
2. Show that harvard.edu is blocked (real domain)
3. Suggest using example.com domains for testing
4. Explain the verification process for real domains

### Real Organization Setup

**Ask Claude:**
```
Help me set up verified issuer status for myuniversity.edu
```

**Claude will:**
1. Generate cryptographic keys
2. Create the well-known issuer file
3. Show you where to host it
4. Explain the verification process

## Available MCP Tools

When you ask Claude to work with badges, it has access to these tools:

### Core Creation Tools
- `create_issuer_v2` - Create Open Badges 2.0 issuer
- `create_issuer_v3` - Create Open Badges 3.0 issuer  
- `create_badge_class_v2` - Create Open Badges 2.0 badge class
- `create_badge_class_v3` - Create Open Badges 3.0 badge class
- `create_assertion_v2` - Create Open Badges 2.0 assertion
- `create_assertion_v3` - Create Open Badges 3.0 assertion

### Validation & Security
- `validate_issuer_domain` - Check domain validity and security
- `get_domain_info` - Get detailed domain information

### File Management
- `list_badge_files` - Browse created badges
- `get_badge_file` - Read specific badge files

## Domain Types & Behavior

### ✅ Verified Domains
**Example**: `your-badge-generator.com`
- ✅ Production ready
- ✅ No warnings
- ✅ Full functionality

**Claude response:**
```
✅ Created issuer for Badge Generator Demo Platform
📍 Domain: your-badge-generator.com (verified)
🎯 Production ready: Yes
```

### 🧪 Testing Domains  
**Examples**: `demo.example.org`, `test.example.com`, `example.com`
- ✅ Allowed for testing
- ⚠️ Shows warning
- ✅ Full functionality

**Claude response:**
```
✅ Created issuer for Demo University
📍 Domain: demo.example.org (testing)
⚠️ Using example.com domain - safe for testing only
🎯 Production ready: No
```

### 🚫 Blocked Domains
**Examples**: `harvard.edu`, `microsoft.com`, `google.com`
- ❌ Blocked without verification
- ❌ Creation fails
- 💡 Shows alternatives

**Claude response:**
```
❌ Cannot create issuer for Harvard University
📍 Domain: harvard.edu (blocked)
🚫 Domain appears to be registered. Please use example.com domains for testing or complete domain verification.

💡 Alternatives:
• Use demo.example.org for testing
• Complete domain verification for harvard.edu
• Use a verified domain from your deployment
```

## Natural Language Examples

### Simple Badge Creation
```
"Create a badge for completing Python Programming 101 from Demo College"
```

### Detailed Badge Creation
```
"I need to create a certificate badge for 'Advanced Data Science' issued by 
Demo University at demo.example.org. The criteria should be completing 
all 8 modules and a capstone project."
```

### Multiple Badges
```
"Create three badges for a web development course: HTML Basics, CSS 
Fundamentals, and JavaScript Essentials. All from Demo Academy."
```

### Domain Validation
```
"Before I create badges, can you check if mycompany.com is allowed?"
```

### Organization Setup
```
"Help me become a verified issuer for realuniversity.edu"
```

### File Management
```
"Show me all the badges that have been created recently"
```

## Organization Verification Process

To use your real domain with Claude:

### 1. Ask Claude to Generate Keys
```
"Generate verification files for My University at myuniversity.edu"
```

### 2. Host the Well-Known File
Claude will create an `issuer.json` file. Upload it to:
```
https://myuniversity.edu/.well-known/issuer.json
```

### 3. Ask Claude to Verify
```
"Verify the domain myuniversity.edu"
```

### 4. Create Production Badges
```
"Now create a badge for Computer Science Degree from My University"
```

## Best Practices

### Testing Phase
- Always start with `demo.example.org` or `test.example.com`
- Test your badge structure before going to production
- Use Claude to validate your domains first

### Production Phase
- Complete domain verification process
- Use Claude to generate proper cryptographic keys
- Host well-known files at the correct location
- Verify domain status before creating production badges

### Security
- Keep private keys secure (Claude won't have access to them)
- Use HTTPS URLs only
- Complete verification for real organizations

## Troubleshooting

### "MCP server not found"
- Check your Claude Desktop config file path
- Ensure the badge-generator path is correct
- Restart Claude Desktop

### "API key not configured"
- Verify the API key in your MCP configuration
- Check for typos in the environment variables

### "Domain validation failed"
- Use example.com domains for testing
- Complete verification for real domains
- Check URL format (must be valid HTTPS)

### "Connection failed"
- Verify internet connection
- Check if the API endpoint is accessible
- Confirm your personal API key is set correctly

## Advanced Features

### Batch Operations
```
"Create 5 different badges for a complete web development bootcamp program"
```

### Custom Badge Specifications
```
"Create an Open Badges 3.0 verifiable credential with custom criteria and alignment to industry standards"
```

### Badge File Management
```
"Show me the JSON structure of the last badge we created and explain how to modify it"
```

## Support

For help:
1. Ask Claude: "Help me troubleshoot the badge generator setup"
2. Check domain validation rules
3. Verify MCP configuration
4. Test with example.com domains first

## Examples Repository

Complete examples available at:
- Basic badge creation workflows
- Organization verification processes  
- Integration testing procedures
- Security best practices

The Badge Generator with Claude integration makes creating compliant, secure Open Badges as simple as having a conversation!
