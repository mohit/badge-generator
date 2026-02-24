# Badge Generator Deployment (LLM)

## Runtime Requirements

- Node.js 18+
- Persistent storage for `uploads/`
- HTTPS domain for production

## Required Environment Variables

- `PUBLIC_DOMAIN` (no scheme, e.g. `badges.firmament.works`)
- `UPLOAD_PASSWORD`
- `API_KEY`
- `DEFAULT_PRIVATE_KEY` (PEM)
- `DEFAULT_PUBLIC_KEY` (PEM)
- `NODE_ENV=production`

Optional:

- `PORT` (set automatically on most platforms)
- `UPLOADS_DIR` (writable storage directory, default `uploads`)

## Key Generation

Generate issuer verification and signing keys with CLI:

```bash
npm run cli generate-keys \
  --name "Your Organization" \
  --url "https://your-domain.com" \
  --email "badges@your-domain.com"
```

Outputs under `issuer-verification-files/`:

- `openbadges-issuer.json`
- `private-key.pem`
- `public-key.pem`

## Well-Known File Hosting

For real domain verification, host:

`https://<your-domain>/.well-known/openbadges-issuer.json`

Then verify issuer domain using:

- CLI: `badge-cli verify <domain>`
- API: `POST /api/issuers/verify`

## Fast Local Start

```bash
npm install
cp .env.example .env
npm start
```

## Docker

```bash
docker build -t badge-generator .
docker run -p 3000:3000 \
  -e PUBLIC_DOMAIN=your-domain.com \
  -e DEFAULT_PRIVATE_KEY="$(cat issuer-verification-files/private-key.pem)" \
  -e DEFAULT_PUBLIC_KEY="$(cat issuer-verification-files/public-key.pem)" \
  -e API_KEY=your-api-key \
  -e UPLOAD_PASSWORD=your-password \
  -e NODE_ENV=production \
  -v badge-uploads:/app/uploads \
  badge-generator
```

## Railway

1. Connect repo.
2. Add a Railway Volume and mount it at `/data/uploads`.
3. Set env vars listed above, including `UPLOADS_DIR=/data/uploads`.
4. Deploy.
5. Confirm the mounted volume is writable.

## Post-Deploy Checks

1. `GET /public/api/verify/issuer/<encoded_issuer_url>` works.
2. `POST /api/issuer` works with `X-API-Key`.
3. `GET /api/badge-files` returns hosted files.
4. `.well-known/openbadges-issuer.json` is reachable on your domain.
