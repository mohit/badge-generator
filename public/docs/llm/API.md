# Badge Generator API (LLM)

## Base URL

- Local: `http://localhost:3000`
- Production example: `https://badges.firmament.works`

## Authentication

Authenticated endpoints require:

`X-API-Key: <API_KEY>`

## Public Verification Endpoints (No API Key)

These are safe for browser use and include server-side URL safety checks.

### Verify Badge by URL

- `GET /public/api/verify/badge/:badgeUrl(*)`
- Example:

```bash
curl "https://badges.firmament.works/public/api/verify/badge/https%3A%2F%2Fexample.com%2Fbadges%2Fassertion.json"
```

### Verify Issuer by URL

- `GET /public/api/verify/issuer/:issuerUrl(*)`
- Example:

```bash
curl "https://badges.firmament.works/public/api/verify/issuer/https%3A%2F%2Fexample.com%2Fissuer.json"
```

### Verify Badge from Inline JSON

- `POST /public/api/verify/json`
- Body: `{"badgeData": { ... }}` or raw badge JSON object
- Example:

```bash
curl -X POST "https://badges.firmament.works/public/api/verify/json" \
  -H "Content-Type: application/json" \
  -d '{"badgeData":{"@context":"https://w3id.org/openbadges/v2","type":"Assertion","id":"https://example.com/assertion/1","recipient":{"type":"email","hashed":false,"identity":"learner@example.com"},"badge":"https://example.com/badges/web-dev","issuedOn":"2026-01-15T00:00:00Z"}}'
```

### Add Verified Issuer to Trust Log (Public, Rate-Limited)

- `POST /public/api/issuers/verify`
- Body: `{"domain":"example.com"}`
- Behavior:
  - Verifies issuer well-known profile ownership.
  - Writes issuer to trust log on success.
  - Rate limited per client IP (defaults: 10 requests / hour).
- Example:

```bash
curl -X POST "https://badges.firmament.works/public/api/issuers/verify" \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com"}'
```

### Prompt-to-Badge Demo (Public, Rate-Limited)

- `POST /public/api/demo/prompt-to-badge`
- Body fields:
  - `summary` (required, min length 12)
  - `learnerName`, `sourceUrl`, `proficiency`, `skills[]`, `badgeName` (optional)
- Returns:
  - `badgeUrl`
  - `verifyUrl`
  - `shareText`
  - `signedBadge`

### Trust Discovery APIs (Public, No API Key)

- `GET /public/api/trust/issuer/:domain`
- `GET /public/api/trust/events/:domain`
- `GET /public/api/trust/issuers?status=verified`

## Verification Endpoints (Also Available Under `/api`, No API Key Required)

- `GET /api/verify/badge/:badgeUrl(*)`
- `GET /api/verify/issuer/:issuerUrl(*)`

Use `/public/api/*` from untrusted input flows; it blocks private/internal network targets.

## Authenticated Endpoints (Require `X-API-Key`)

### File Listing

- `GET /api/badge-files`
- Returns hosted JSON files under `/badges/*`.
- `GET /api/metrics`
  - Runtime counters: verification volume, external fetches, cache hit rate, trust writes.

### Domain Validation

- `GET /api/validate-issuer-domain?url=<issuer_or_resource_url>`

Domain result `type` values:

- `verified`
- `verified-external`
- `testing`
- `unverified`
- `verification-failed`
- `unregistered`
- `invalid`

### Issuer Verification Management

- `POST /api/issuers/verify`
  - Body: `{"domain":"example.com"}`
  - Admin-authenticated trust write (supports explicit re-verification workflows)
- `GET /api/issuers/:domain`
- `GET /api/issuers`
- `POST /api/issuers/:domain/reverify`

### Key and Signing Operations

- `POST /api/cache-public-key`
  - Body: `{"issuerUrl":"https://example.com/issuer.json"}`
- `POST /api/sign-badge`
  - Body: `{"badgeData":{...},"domain":"example.com"}`
  - Signs with configured key material for your domain.

### Resource Creation

- `POST /api/issuer`
  - Required body fields: `id`, `name`, `url`
- `POST /api/badge-class`
  - Required body fields: `id`, `name`, `description`, `criteria`, `issuer`
- `POST /api/credential-subject`
  - Required body fields: `id`, `recipient`, `badge`

All creation endpoints:

- Validate domain usage
- Persist JSON to `uploads/`
- Return hosted URL under `/badges/<filename>.json`

## Common Verification Response Fields

Badge verification responses commonly include:

- `valid` (boolean)
- `version` (`v2.0` or `v3.0`)
- `structure` (field checks, errors, warnings)
- `issuer` (issuer validation result)
- `signature` (cryptographic proof validation result)
- `verificationLevel` (e.g. `cryptographically_verified`, `fully_verified`, `remote_verified`, `invalid`)
- `trustState` (`DOMAIN_VERIFIED_SIGNATURE` or `UNVERIFIED`)
- `issuerDomain` (canonical domain identity)
- `keyFingerprint` (SHA-256 fingerprint when key is discoverable)
- `verificationReason` (human-readable trust reason)
- `issuerClaimedName` (non-canonical issuer name claim)
- `verifiedAt` (ISO timestamp)

## Error Patterns

- `400` invalid input, invalid URL, blocked URL, or domain validation failures
- `401` invalid API key for authenticated endpoints
- `500` unexpected server error

## Minimal Issuing Workflow

1. Validate domain with `/api/validate-issuer-domain`.
2. Create issuer with `/api/issuer`.
3. Create badge class with `/api/badge-class`.
4. Create credential with `/api/credential-subject`.
5. Optionally sign with `/api/sign-badge`.
6. Verify with `/public/api/verify/*`.
