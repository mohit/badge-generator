# Badge CLI (LLM)

CLI entrypoint: `cli/badge-cli.js`

## Install

```bash
npm install
node cli/badge-cli.js --help
```

## Configure

```bash
node cli/badge-cli.js config --base-url "https://badges.firmament.works"
node cli/badge-cli.js config --show
```

Optional (only for trust-log writes/reads and issuing/signing APIs):

```bash
node cli/badge-cli.js config --api-key "<API_KEY>"
```

Config file: `.badge-cli-config.json`

## Core Commands

### Connectivity

```bash
node cli/badge-cli.js test-connection
```

### Domain Validation

```bash
node cli/badge-cli.js validate "https://demo.example.org/issuer"
node cli/badge-cli.js validate "https://demo.example.org/issuer" --server-policy
```

### Issuer and Badge Creation

```bash
node cli/badge-cli.js create-issuer \
  --name "Demo University" \
  --url "https://demo.example.org" \
  --email "badges@demo.example.org"

node cli/badge-cli.js create-badge \
  --name "Web Development Certificate" \
  --description "Completed web development curriculum" \
  --issuer "https://demo.example.org/issuer"
```

### Keys and Domain Verification

```bash
node cli/badge-cli.js generate-keys \
  --name "Demo University" \
  --url "https://demo.example.org" \
  --email "badges@demo.example.org"

node cli/badge-cli.js verify "demo.example.org"
node cli/badge-cli.js verify "demo.example.org" --log-trust
node cli/badge-cli.js get-issuer "demo.example.org"
node cli/badge-cli.js get-issuer "demo.example.org" --log-trust
```

### Verification

```bash
node cli/badge-cli.js verify-badge "https://example.com/assertion.json"
node cli/badge-cli.js verify-badge "./sample-badge-v3-signed.json"
node cli/badge-cli.js verify-issuer-url "https://example.com/issuer.json"
```

### Signing

```bash
# Managed signing via server key (requires API key)
node cli/badge-cli.js sign-badge ./badge.json demo.example.org --output ./badge-signed.json

# Local signing via your private key (no API key required)
node cli/badge-cli.js sign-badge ./badge.json --local \
  --private-key-file ./issuer-verification-files/private-key.pem \
  --issuer-url "https://demo.example.org/.well-known/openbadges-issuer.json" \
  --output ./badge-signed.json
```

## Typical Workflow

1. `config --base-url`.
2. `validate` and `verify` (public, no trust log write).
3. `verify-badge` and `verify-issuer-url`.
4. Add API key only when you need `--log-trust`, issuing endpoints, or managed server signing.
