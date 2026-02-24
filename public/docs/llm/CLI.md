# Badge CLI (LLM)

CLI entrypoint: `cli/badge-cli.js`

## Install

```bash
npm install
node cli/badge-cli.js --help
```

## Configure

```bash
node cli/badge-cli.js config --api-key "<API_KEY>"
node cli/badge-cli.js config --base-url "https://badges.firmament.works"
node cli/badge-cli.js config --show
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
node cli/badge-cli.js get-issuer "demo.example.org"
```

### Verification

```bash
node cli/badge-cli.js verify-badge "https://example.com/assertion.json"
node cli/badge-cli.js verify-issuer-url "https://example.com/issuer.json"
```

### Signing

```bash
node cli/badge-cli.js sign-badge ./badge.json demo.example.org --output ./badge-signed.json
```

## Typical Workflow

1. `config` with API key and base URL.
2. `validate` issuer domain.
3. `create-issuer`.
4. `create-badge`.
5. `verify-badge` for resulting hosted JSON.
6. `sign-badge` when cryptographic proof is required.
