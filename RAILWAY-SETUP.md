# Railway Deployment & Security Setup Guide

## 🔐 Simplified & Secure Key Management

Our badge verification system uses a **smart architecture**:
- **ONE** private key (yours) for signing your badges
- **Auto-cached** public keys from other verified issuers for verification

### Step 1: Generate YOUR Signing Keys

Generate keys for **your domain only** (these will NOT be committed to git):

```bash
# Use the CLI tool to generate keys for YOUR domain
npm run cli generate-keys \
  --name "Your Organization Name" \
  --url "https://badge-generator-production.up.railway.app" \
  --email "badges@yourdomain.com"

# This creates files in issuer-verification-files/
# - private-key.pem (NEVER commit - for YOUR domain only)
# - public-key.pem (for YOUR domain only)
# - issuer.json
```

### Step 2: Set Railway Environment Variables

In your Railway dashboard, add **only these** environment variables:

#### Required Keys (YOUR domain only):
```bash
# Your private key for signing badges from your domain
DEFAULT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...
-----END PRIVATE KEY-----"

# Your public key for verification (backup)
DEFAULT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA...
-----END PUBLIC KEY-----"
```

**No domain-specific keys needed!** The system automatically:
- ✅ Uses your private key only for your domain
- ✅ Fetches & caches public keys from other issuers via API
- ✅ Stores cached keys in Railway's persistent volume

### Step 3: Production Environment Settings

Also set these Railway environment variables:

```bash
# Ensure production mode
NODE_ENV=production

# Your domain (IMPORTANT: Set this to your Railway domain)
PUBLIC_DOMAIN=badge-generator-production.up.railway.app

# Your existing API credentials
API_KEY=your_secure_api_key_here
UPLOAD_PASSWORD=your_secure_upload_password_here

# Port (Railway auto-sets this)
PORT=3000
```

**Important**: Set `PUBLIC_DOMAIN` to your actual Railway domain (without https://). This ensures the system only signs badges for your domain.

### Step 4: Verify Setup

After deployment, test the signing functionality:

```bash
# Test badge signing
curl -X POST "https://your-app.railway.app/api/sign-badge" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "badgeData": {
      "@context": "https://w3id.org/openbadges/v2",
      "type": "Assertion",
      "id": "https://your-app.railway.app/badges/test.json",
      "recipient": {"type": "email", "hashed": false, "identity": "test@example.com"},
      "badge": "https://your-app.railway.app/badges/test-badge.json",
      "issuedOn": "2024-01-01T00:00:00Z"
    },
    "domain": "your-app.railway.app"
  }'
```

## 🔒 Security Best Practices

### ✅ DO:
- ✅ Store private keys in Railway environment variables
- ✅ Use strong, randomly generated keys
- ✅ Set `NODE_ENV=production` in Railway
- ✅ Use HTTPS for all badge URLs
- ✅ Regularly rotate signing keys

### ❌ DON'T:
- ❌ Commit .pem files to git
- ❌ Share private keys via email/chat
- ❌ Use the same keys across environments
- ❌ Store keys in code or config files

## 🚀 Key Rotation Process

To rotate your signing keys:

1. **Generate new keys locally**:
   ```bash
   npm run cli generate-keys --name "Your Org" --url "https://your-domain.com" --email "badges@your-domain.com"
   ```

2. **Update Railway environment variables** with the new keys

3. **Update your issuer profiles** with new public keys:
   - Host the new `issuer.json` at `https://your-domain.com/.well-known/issuer.json`

4. **Gradually phase out old keys** (keep both for a transition period)

## 🔍 Troubleshooting

### "No signing key found" Error:
- Check that `DEFAULT_PRIVATE_KEY` is set in Railway
- Verify the key format (must include `-----BEGIN PRIVATE KEY-----` headers)
- Ensure no extra spaces or newlines in the environment variable

### "Invalid signature" Error:
- Verify public/private key pair match
- Check that the public key is accessible to verifiers
- Ensure the issuer profile contains the correct public key

### Key Format Issues:
```bash
# Keys should be in PEM format like this:
-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...
-----END PRIVATE KEY-----
```

## 📝 Environment Variable Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `DEFAULT_PRIVATE_KEY` | ✅ Yes | Private key for badge signing |
| `DEFAULT_PUBLIC_KEY` | ✅ Yes | Public key for verification |
| `PUBLIC_DOMAIN` | ✅ Yes | Your domain (e.g., your-app.railway.app) |
| `NODE_ENV` | ✅ Yes | Set to "production" |
| `API_KEY` | ✅ Yes | API authentication key |
| `UPLOAD_PASSWORD` | ✅ Yes | Web interface password |
| `PORT` | ⚪ Optional | Server port (Railway auto-sets) |

This setup ensures your badge signing keys are secure and never exposed in your codebase! 🔐