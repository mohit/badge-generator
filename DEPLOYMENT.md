# Deployment Guide

Deploy your Badge Generator on any platform with these comprehensive guides.

## 🚀 Quick Start

The Badge Generator is a Node.js application that can be deployed anywhere. It requires:
- Node.js 18+
- Persistent storage for badge files
- Environment variables for configuration

## 📋 Required Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DEFAULT_PRIVATE_KEY` | ✅ Yes | Private key for badge signing | `-----BEGIN PRIVATE KEY-----...` |
| `DEFAULT_PUBLIC_KEY` | ✅ Yes | Public key for verification | `-----BEGIN PUBLIC KEY-----...` |
| `PUBLIC_DOMAIN` | ✅ Yes | Your domain (without https://) | `my-badges.com` |
| `NODE_ENV` | ✅ Yes | Environment mode | `production` |
| `API_KEY` | ✅ Yes | API authentication key | `your-secure-api-key` |
| `UPLOAD_PASSWORD` | ✅ Yes | Web interface password | `your-secure-password` |
| `PORT` | ⚪ Optional | Server port | `3000` (auto-set on most platforms) |
| `UPLOADS_DIR` | ⚪ Optional | Writable path for uploaded files + verifier state | `uploads` or `/data/uploads` |

## 🔐 Generating Signing Keys

Before deployment, generate your cryptographic keys:

```bash
# Clone and setup locally
git clone https://github.com/yourusername/badge-generator.git
cd badge-generator
npm install

# Generate your signing keys
npm run cli generate-keys \
  --name "Your Organization" \
  --url "https://your-domain.com" \
  --email "badges@your-domain.com"

# This creates issuer-verification-files/ with:
# - private-key.pem (for DEFAULT_PRIVATE_KEY env var)
# - public-key.pem (for DEFAULT_PUBLIC_KEY env var)
# - issuer.json (host at /.well-known/issuer.json)
```

---

## 🐳 Docker Deployment

### Quick Start with Docker

```bash
# Build and run
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

### Docker Compose

```yaml
version: '3.8'
services:
  badge-generator:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PUBLIC_DOMAIN=your-domain.com
      - DEFAULT_PRIVATE_KEY=${DEFAULT_PRIVATE_KEY}
      - DEFAULT_PUBLIC_KEY=${DEFAULT_PUBLIC_KEY}
      - API_KEY=${API_KEY}
      - UPLOAD_PASSWORD=${UPLOAD_PASSWORD}
      - NODE_ENV=production
    volumes:
      - badge-uploads:/app/uploads
    restart: unless-stopped

volumes:
  badge-uploads:
```

---

## 🚂 Railway Deployment

### Setup

1. **Connect Repository**: Link your GitHub repo to Railway
2. **Set Environment Variables**:
   ```bash
   PUBLIC_DOMAIN=your-app.railway.app
   DEFAULT_PRIVATE_KEY=<paste private key>
   DEFAULT_PUBLIC_KEY=<paste public key>
   API_KEY=<generate secure key>
   UPLOAD_PASSWORD=<generate secure password>
   NODE_ENV=production
   UPLOADS_DIR=/data/uploads
   ```
3. **Add a Railway Volume** and mount it at `/data/uploads`
4. **Deploy**: Railway auto-deploys from main branch

### Railway-Specific Notes
- ✅ Uses persistent volumes for uploads
- ✅ Auto-sets PORT environment variable
- ✅ Supports custom domains
- ✅ `UPLOADS_DIR` should point at your mounted volume path (for example `/data/uploads`)

---

## 🟣 Heroku Deployment

### Setup

```bash
# Install Heroku CLI and login
heroku create your-badge-generator

# Set environment variables
heroku config:set PUBLIC_DOMAIN=your-app.herokuapp.com
heroku config:set DEFAULT_PRIVATE_KEY="$(cat issuer-verification-files/private-key.pem)"
heroku config:set DEFAULT_PUBLIC_KEY="$(cat issuer-verification-files/public-key.pem)"
heroku config:set API_KEY=your-api-key
heroku config:set UPLOAD_PASSWORD=your-password
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### Heroku-Specific Notes
- ⚠️ **Ephemeral Storage**: Files reset on restart
- ✅ Consider add-ons for persistent storage
- ✅ Auto-sets PORT environment variable

---

## 🌊 DigitalOcean App Platform

### Setup

1. **Create App**: Connect your GitHub repo
2. **Configure Build**:
   ```yaml
   name: badge-generator
   services:
   - name: api
     source_dir: /
     github:
       repo: yourusername/badge-generator
       branch: main
     run_command: npm start
     environment_slug: node-js
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
     - key: PUBLIC_DOMAIN
       value: your-app.ondigitalocean.app
     - key: NODE_ENV
       value: production
     # Add other env vars via dashboard
   ```

### DigitalOcean-Specific Notes
- ✅ Persistent volumes available
- ✅ Auto-SSL with custom domains
- ✅ Auto-scaling options

---

## 🖥️ Self-Hosted (VPS/Server)

### Requirements
- Ubuntu 20.04+ / CentOS 8+ / Similar
- Node.js 18+
- Nginx (recommended)
- SSL certificate

### Setup

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone https://github.com/yourusername/badge-generator.git
cd badge-generator
npm install --production

# Create systemd service
sudo nano /etc/systemd/system/badge-generator.service
```

### Systemd Service File
```ini
[Unit]
Description=Badge Generator
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/badge-generator
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PUBLIC_DOMAIN=your-domain.com
Environment=DEFAULT_PRIVATE_KEY=your-private-key
Environment=DEFAULT_PUBLIC_KEY=your-public-key
Environment=API_KEY=your-api-key
Environment=UPLOAD_PASSWORD=your-password
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## ☁️ Other Platforms

### Vercel (Serverless)
- ⚠️ **Not Recommended**: Requires persistent storage for uploads
- 🔧 **Alternative**: Use external storage (AWS S3, etc.)

### Netlify (Static)
- ❌ **Not Compatible**: Requires Node.js server

### AWS EC2
- ✅ Follow self-hosted guide above
- ✅ Use EBS for persistent storage
- ✅ Consider ELB for high availability

### Google Cloud Run
- ✅ Use Docker deployment
- ✅ Mount persistent volumes
- ✅ Set environment variables

---

## 🔒 Security Best Practices

### For All Deployments:
- ✅ Use HTTPS in production
- ✅ Set strong `API_KEY` and `UPLOAD_PASSWORD`
- ✅ Keep private keys secure and never commit to git
- ✅ Use `NODE_ENV=production`
- ✅ Regularly update dependencies

### Domain Setup:
1. **Host issuer.json**: Place generated `issuer.json` at `https://your-domain.com/.well-known/issuer.json`
2. **Set PUBLIC_DOMAIN**: Must match your actual domain
3. **SSL Certificate**: Required for badge verification

---

## 🧪 Testing Your Deployment

```bash
# Test API endpoint
curl https://your-domain.com/api/validate-issuer-domain?url=https://demo.example.org

# Test badge verification
curl -H "X-API-Key: your-api-key" \
  "https://your-domain.com/api/verify/badge/https%3A//demo.example.org/badge.json"

# Test web interface
open https://your-domain.com/upload
```

---

## 🆘 Troubleshooting

### Common Issues:
1. **"No signing key found"**: Check `DEFAULT_PRIVATE_KEY` env var
2. **"Domain validation failed"**: Verify `PUBLIC_DOMAIN` setting
3. **500 errors**: Check application logs
4. **Uploads not persisting**: Ensure persistent storage is configured

### Getting Help:
- 📖 Check the troubleshooting section in README.md
- 🐛 Report issues on GitHub
- 💬 Join our community discussions

---

## 🔄 Updating Your Deployment

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install

# Restart service (varies by platform)
# Docker: docker-compose restart
# Systemd: sudo systemctl restart badge-generator
# Railway/Heroku: Auto-redeploys on git push
```

Choose the deployment method that best fits your needs! 🚀
