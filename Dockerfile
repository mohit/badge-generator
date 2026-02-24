# Badge Generator - Multi-platform Docker Build

FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S badge-generator -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create uploads directory and set permissions
RUN mkdir -p uploads uploads/cached-public-keys
RUN chown -R badge-generator:nodejs uploads

# Remove development files if accidentally copied
RUN rm -rf issuer-verification-files/ .badge-cli-config.json

# Start as root so mounted volume ownership can be corrected at runtime.
USER root

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application:
# 1) ensure configured uploads directory exists and is writable by badge-generator
# 2) drop privileges and run as badge-generator
CMD ["sh", "-c", "UPLOADS_PATH=\"${UPLOADS_DIR:-uploads}\" && mkdir -p \"$UPLOADS_PATH\" && chown -R badge-generator:nodejs \"$UPLOADS_PATH\" && exec su badge-generator -s /bin/sh -c 'npm start'"]
