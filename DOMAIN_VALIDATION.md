# Domain Validation System

This document describes the domain validation system implemented to prevent issuer impersonation while maintaining flexibility for testing.

## Overview

The Badge Generator now validates all issuer domains to prevent users from creating badges that impersonate real organizations they don't control, while providing safe alternatives for testing and a verified default issuer.

## Domain Types

### 🔒 Verified Domains
- **badge-generator-production.up.railway.app** - Our verified issuer
- Hosted at `/.well-known/openbadges-issuer.json` with cryptographic profile
- Production-ready for real badge issuance
- No warnings or restrictions

### 🧪 Testing Domains (Allowed)
- **example.com**, **example.org**, **example.net**
- **demo.example.org**, **test.example.com**, etc.
- Safe for testing and demonstrations
- Shows warning: "Using example.com domain - safe for testing only"

### 🚫 Blocked Domains
- Any registered domain not in the allowlist
- Examples: harvard.edu, microsoft.com, google.com
- Prevents impersonation of real organizations
- Returns error: "Domain appears to be registered. Please use example.com domains for testing or our verified issuer."

### ⚠️ Unregistered Domains (Allowed with Warning)
- localhost, 127.0.0.1
- Custom unregistered domains
- Shows warning: "Using unregistered domain - ensure this is intentional"

## API Endpoints

### Domain Validation
```http
GET /api/validate-issuer-domain?url=https://demo.example.org/issuer
X-API-Key: your_api_key
```

**Response:**
```json
{
  "valid": true,
  "type": "testing",
  "warnings": ["Using example.com domain - safe for testing only"],
  "message": "Safe testing domain"
}
```

### Enhanced Badge Creation
All creation endpoints now include domain validation:

```json
{
  "message": "Issuer created successfully",
  "filename": "issuer-123.json",
  "url": "https://badge-generator.up.railway.app/badges/issuer-123.json",
  "issuer": { ... },
  "warnings": ["Using example.com domain - safe for testing only"],
  "domain_info": {
    "type": "testing",
    "message": "Safe testing domain",
    "is_production_ready": false
  }
}
```

## Well-Known Issuer Profile

Our verified issuer profile is hosted at:
**https://badge-generator-production.up.railway.app/.well-known/openbadges-issuer.json**

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://badge-generator-production.up.railway.app/.well-known/openbadges-issuer.json",
  "type": "Profile",
  "name": "Badge Generator Demo Platform",
  "url": "https://badge-generator-production.up.railway.app",
  "email": "demo@badge-generator-demo.example.com",
  "description": "A demonstration platform for creating and hosting Open Badges. This is a verified default issuer for testing and demonstration purposes.",
  "official": true,
  "verified": true,
  "publicKey": {
    "id": "https://badge-generator-production.up.railway.app/.well-known/openbadges-issuer.json#key",
    "type": "Ed25519VerificationKey2020",
    "controller": "https://badge-generator-production.up.railway.app/.well-known/openbadges-issuer.json",
    "publicKeyMultibase": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnYuYByT1S"
  }
}
```

## MCP Server Integration

The MCP server includes domain validation tools:

### `validate_issuer_domain`
Check domain validity before creating badges:
```
validate_issuer_domain url=https://demo.example.org/issuer
```

### Enhanced Creation Tools
All `create_*` tools now show:
- Domain validation warnings
- Production readiness status
- Domain type classification

## Templates Updated

All templates now use safe demo domains:
- **v2.0**: `demo.example.org`
- **v3.0**: `demo.example.org`
- **Smart Badge Creator**: Examples use `demo.example.org` and `test.example.com`

## Future Enhancements

### Web Verification (Planned)
- Allow real domains with web verification
- Check for `/.well-known/openbadges-issuer.json` at claiming domain
- Require proof of domain ownership
- Enable legitimate organizations to verify themselves

## Security Benefits

1. **Prevents Impersonation**: Users cannot claim to represent organizations they don't control
2. **Safe Testing**: Clear guidance toward example.com domains
3. **Verified Default**: Production-ready issuer with cryptographic verification
4. **Educational**: Teaches proper badge issuing practices
5. **Compliance**: Maintains Open Badges specification compliance

## Error Handling

The system provides clear error messages:
- **Invalid URL**: "Invalid URL format"
- **Blocked Domain**: "Domain 'harvard.edu' appears to be registered. Please use example.com domains for testing or our verified issuer."
- **Missing API Key**: "API key not configured"

All errors include suggestions for resolution and alternative approaches.
