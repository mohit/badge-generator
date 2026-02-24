#!/usr/bin/env node

import { program } from 'commander';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import { realpathSync } from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuration
const DEFAULT_BASE_URL = process.env.BADGE_CLI_BASE_URL || 'http://localhost:3000';
const CONFIG_FILE = path.join(process.cwd(), '.badge-cli-config.json');

class BadgeCLI {
  constructor() {
    this.config = {};
  }

  static SAFE_TEST_DOMAINS = [
    'example.com',
    'example.org',
    'example.net',
    'test.example.com',
    'demo.example.org',
    'localhost',
    '127.0.0.1'
  ];

  isHttpUrl(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async getLocalBadgePath(badgeSource) {
    try {
      const resolvedPath = path.resolve(badgeSource);
      const stats = await fs.stat(resolvedPath);
      return stats.isFile() ? resolvedPath : null;
    } catch {
      return null;
    }
  }

  async loadConfig() {
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // Config file doesn't exist, use defaults
      this.config = {
        baseUrl: DEFAULT_BASE_URL,
        apiKey: ''
      };
    }
  }

  async saveConfig() {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  requireApiKey() {
    if (!this.config.apiKey) {
      throw new Error('API key not configured. Run: node cli/badge-cli.js config --api-key YOUR_KEY');
    }
  }

  normalizeDomain(domainInput) {
    const trimmed = String(domainInput || '').trim();
    const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    return parsed.host.toLowerCase();
  }

  getWellKnownIssuerUrls(domainInput) {
    const host = this.normalizeDomain(domainInput);
    return [`https://${host}/.well-known/openbadges-issuer.json`];
  }

  validateDomainLocally(url) {
    try {
      const parsed = new URL(url);
      const protocol = parsed.protocol.toLowerCase();
      const hostname = parsed.hostname.toLowerCase();
      const isSafeTestDomain = BadgeCLI.SAFE_TEST_DOMAINS.some((safeDomain) =>
        hostname === safeDomain || hostname.endsWith(`.${safeDomain}`)
      );

      if (protocol !== 'http:' && protocol !== 'https:') {
        return {
          valid: false,
          type: 'invalid',
          message: 'Only http and https URLs are supported',
          warnings: []
        };
      }

      if (isSafeTestDomain) {
        return {
          valid: true,
          type: 'testing',
          message: 'Safe testing domain',
          warnings: ['Using an example/local domain intended for testing']
        };
      }

      return {
        valid: true,
        type: 'unverified',
        message: 'URL format is valid (local check only)',
        warnings: ['No trust log read/write performed. Use verify --log-trust to persist trust state.']
      };
    } catch {
      return {
        valid: false,
        type: 'invalid',
        message: 'Invalid URL format',
        warnings: []
      };
    }
  }

  async makeRequest(endpoint, options = {}, requestConfig = {}) {
    const { requireApiKey = false } = requestConfig;
    if (requireApiKey) {
      this.requireApiKey();
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }
    const requestOptions = {
      headers,
      ...options
    };

    const response = await fetch(url, requestOptions);
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await response.json() : { message: await response.text() };

    if (!response.ok) {
      throw new Error(`API Error: ${data.error || data.message || response.statusText}`);
    }

    return data;
  }

  generateKeyPair() {
    // Generate Ed25519 key pair for Open Badges
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return { publicKey, privateKey };
  }

  async validateDomain(url, options = {}) {
    const { serverPolicy = false } = options;
    console.log(`🔍 Validating domain: ${url}`);
    
    try {
      const localResult = this.validateDomainLocally(url);
      
      console.log(`✅ Local validation result:`);
      console.log(`   Type: ${localResult.type}`);
      console.log(`   Valid: ${localResult.valid}`);
      console.log(`   Message: ${localResult.message}`);
      
      if (localResult.warnings && localResult.warnings.length > 0) {
        console.log(`⚠️  Warnings:`);
        localResult.warnings.forEach(warning => console.log(`   - ${warning}`));
      }

      if (!serverPolicy) {
        return localResult;
      }

      console.log('🌐 Checking server policy (requires API key)...');
      const serverResult = await this.makeRequest(
        `/api/validate-issuer-domain?url=${encodeURIComponent(url)}`,
        {},
        { requireApiKey: true }
      );
      console.log(`✅ Server policy result:`);
      console.log(`   Type: ${serverResult.type}`);
      console.log(`   Valid: ${serverResult.valid}`);
      console.log(`   Message: ${serverResult.message}`);
      
      if (serverResult.warnings && serverResult.warnings.length > 0) {
        console.log(`⚠️  Warnings:`);
        serverResult.warnings.forEach(warning => console.log(`   - ${warning}`));
      }

      return { local: localResult, server: serverResult };
    } catch (error) {
      console.error(`❌ Domain validation failed: ${error.message}`);
      throw error;
    }
  }

  async createIssuer(issuerData) {
    console.log(`🏗️  Creating issuer: ${issuerData.name}`);
    
    try {
      const result = await this.makeRequest('/api/issuer', {
        method: 'POST',
        body: JSON.stringify(issuerData)
      }, { requireApiKey: true });
      
      console.log(`✅ Issuer created successfully:`);
      console.log(`   Filename: ${result.filename}`);
      console.log(`   URL: ${result.url}`);
      
      if (result.warnings && result.warnings.length > 0) {
        console.log(`⚠️  Warnings:`);
        result.warnings.forEach(warning => console.log(`   - ${warning}`));
      }
      
      if (result.domain_info) {
        console.log(`📊 Domain Info:`);
        console.log(`   Type: ${result.domain_info.type}`);
        console.log(`   Production Ready: ${result.domain_info.is_production_ready}`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Issuer creation failed: ${error.message}`);
      throw error;
    }
  }

  async createBadgeClass(badgeData) {
    console.log(`🎖️  Creating badge class: ${badgeData.name}`);
    
    try {
      const result = await this.makeRequest('/api/badge-class', {
        method: 'POST',
        body: JSON.stringify(badgeData)
      }, { requireApiKey: true });
      
      console.log(`✅ Badge class created successfully:`);
      console.log(`   Filename: ${result.filename}`);
      console.log(`   URL: ${result.url}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Badge class creation failed: ${error.message}`);
      throw error;
    }
  }

  async verifyIssuer(domain, options = {}) {
    const { force = false, logTrust = false } = options;
    const normalizedDomain = this.normalizeDomain(domain);
    console.log(`🔐 Verifying issuer for domain: ${normalizedDomain}`);
    
    try {
      if (logTrust) {
        const result = await this.makeRequest('/api/issuers/verify', {
          method: 'POST',
          body: JSON.stringify({
            domain: normalizedDomain,
            force
          })
        }, { requireApiKey: true });
        
        console.log(`✅ Issuer verification completed (trust logged):`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Message: ${result.message}`);
        
        if (result.verificationDetails) {
          console.log(`📋 Verification Details:`);
          Object.entries(result.verificationDetails).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
          });
        }
        
        return result;
      }

      if (force) {
        console.log('ℹ️  --force has no effect without --log-trust');
      }

      const candidateUrls = this.getWellKnownIssuerUrls(normalizedDomain);
      const failures = [];
      for (const issuerUrl of candidateUrls) {
        try {
          const result = await this.makeRequest(`/public/api/verify/issuer/${encodeURIComponent(issuerUrl)}`);
          const isValid = Boolean(result.verification?.valid ?? result.valid);
          if (isValid) {
            console.log(`✅ Issuer verification completed (no trust log write):`);
            console.log(`   URL: ${issuerUrl}`);
            console.log(`   Message: ${result.verification?.message || result.message || 'Issuer verified'}`);
            return result;
          }

          failures.push(`${issuerUrl}: ${result.verification?.message || 'invalid issuer profile'}`);
        } catch (error) {
          failures.push(`${issuerUrl}: ${error.message}`);
        }
      }

      throw new Error(`Unable to verify issuer from well-known paths. ${failures.join(' | ')}`);
    } catch (error) {
      console.error(`❌ Issuer verification failed: ${error.message}`);
      throw error;
    }
  }

  async getVerifiedIssuer(domain, options = {}) {
    const { logTrust = false } = options;
    const normalizedDomain = this.normalizeDomain(domain);
    console.log(`📋 Getting issuer info for: ${normalizedDomain}`);
    
    try {
      if (!logTrust) {
        console.log('ℹ️  Running live issuer check (no trust-log read). Use --log-trust to read stored issuer state.');
        return this.verifyIssuer(normalizedDomain, { logTrust: false });
      }

      const result = await this.makeRequest(
        `/api/issuers/${encodeURIComponent(normalizedDomain)}`,
        {},
        { requireApiKey: true }
      );
      const issuer = result.issuer || {};
      const status = result.status || issuer.status || 'unknown';
      const isVerified = status === 'verified';
      const addedAt = issuer.lastVerified || issuer.lastUpdated || null;
      
      console.log(`✅ Verified issuer found (trust log):`);
      console.log(`   Name: ${issuer.displayName || issuer.name || 'Unknown'}`);
      console.log(`   Status: ${status}`);
      console.log(`   Verified: ${isVerified ? 'Yes' : 'No'}`);
      console.log(`   Added: ${addedAt ? new Date(addedAt).toLocaleDateString() : 'Unknown'}`);
      
      if (issuer.url) {
        console.log(`   URL: ${issuer.url}`);
      }

      if (issuer.wellKnownUrl) {
        console.log(`   Well-Known URL: ${issuer.wellKnownUrl}`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to get verified issuer: ${error.message}`);
      throw error;
    }
  }

  async verifyBadge(badgeSource) {
    console.log(`🔍 Verifying badge: ${badgeSource}`);
    
    try {
      const localBadgePath = await this.getLocalBadgePath(badgeSource);
      const isRemoteUrl = this.isHttpUrl(badgeSource);
      let result;
      let sourceLabel = badgeSource;

      if (localBadgePath) {
        const badgeData = JSON.parse(await fs.readFile(localBadgePath, 'utf8'));
        result = await this.makeRequest('/public/api/verify/json', {
          method: 'POST',
          body: JSON.stringify({ badgeData })
        });
        sourceLabel = localBadgePath;
      } else if (isRemoteUrl) {
        result = await this.makeRequest(`/public/api/verify/badge/${encodeURIComponent(badgeSource)}`);
      } else {
        throw new Error('Badge source must be an http(s) URL or a path to a local JSON file');
      }
      
      const statusIcon = result.valid ? '✅' : '❌';
      const levelEmojis = {
        'cryptographically_verified': '🔐',
        'fully_verified': '✅',
        'remote_verified': '🌐',
        'basic_verified': '📋',
        'structure_only': '📝',
        'structure_valid_issuer_invalid': '⚠️',
        'invalid': '❌'
      };
      
      console.log(`${statusIcon} Badge Verification: ${result.valid ? 'VALID' : 'INVALID'}`);
      console.log(`   Badge Source: ${sourceLabel}`);
      console.log(`   Version: ${result.version}`);
      console.log(`   Level: ${levelEmojis[result.verificationLevel] || '❓'} ${result.verificationLevel}`);
      
      // Structure details
      if (result.structure) {
        const structIcon = result.structure.valid ? '✅' : '❌';
        console.log(`   Structure: ${structIcon} ${result.structure.valid ? 'Valid' : 'Invalid'}`);
        if (result.structure.errors && result.structure.errors.length > 0) {
          console.log(`     Errors: ${result.structure.errors.join(', ')}`);
        }
        if (result.structure.warnings && result.structure.warnings.length > 0) {
          console.log(`     Warnings: ${result.structure.warnings.join(', ')}`);
        }
      }
      
      // Issuer details
      if (result.issuer) {
        const issuerIcon = result.issuer.valid ? '✅' : '❌';
        console.log(`   Issuer: ${issuerIcon} ${result.issuer.message || (result.issuer.valid ? 'Valid' : 'Invalid')}`);
        if (result.issuer.type) {
          console.log(`     Type: ${result.issuer.type}`);
        }
      }
      
      // Signature details
      if (result.signature) {
        const sigIcon = result.signature.valid ? '🔐' : '❌';
        console.log(`   Signature: ${sigIcon} ${result.signature.message || (result.signature.valid ? 'Valid' : 'Invalid')}`);
        if (result.signature.signatureType) {
          console.log(`     Type: ${result.signature.signatureType}`);
        }
      } else {
        console.log(`   Signature: ➖ No cryptographic signature found`);
      }
      
      console.log(`   Verified at: ${new Date(result.verifiedAt).toLocaleString()}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Badge verification failed: ${error.message}`);
      throw error;
    }
  }

  async verifyIssuerUrl(issuerUrl) {
    console.log(`🔍 Verifying issuer: ${issuerUrl}`);
    
    try {
      const result = await this.makeRequest(`/public/api/verify/issuer/${encodeURIComponent(issuerUrl)}`);
      
      const statusIcon = result.verification.valid ? '✅' : '❌';
      
      console.log(`${statusIcon} Issuer Verification: ${result.verification.valid ? 'VALID' : 'INVALID'}`);
      console.log(`   Issuer URL: ${issuerUrl}`);
      console.log(`   Type: ${result.verification.type || 'Unknown'}`);
      console.log(`   Message: ${result.verification.message || 'No message'}`);
      
      if (result.verification.issuer) {
        console.log(`   📋 Issuer Information:`);
        console.log(`     Name: ${result.verification.issuer.name || 'Unknown'}`);
        console.log(`     ID: ${result.verification.issuer.id || 'Unknown'}`);
        if (result.verification.issuer.url) {
          console.log(`     URL: ${result.verification.issuer.url}`);
        }
        if (result.verification.issuer.email) {
          console.log(`     Email: ${result.verification.issuer.email}`);
        }
      }
      
      if (result.verification.error) {
        console.log(`   ❌ Error: ${result.verification.error}`);
      }
      
      console.log(`   Verified at: ${new Date(result.verifiedAt).toLocaleString()}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Issuer verification failed: ${error.message}`);
      throw error;
    }
  }

  async signBadge(badgeData, domain) {
    console.log(`🔐 Signing badge for domain: ${domain}`);
    
    try {
      const result = await this.makeRequest('/api/sign-badge', {
        method: 'POST',
        body: JSON.stringify({ badgeData, domain })
      }, { requireApiKey: true });
      
      console.log(`✅ Badge signed successfully:`);
      console.log(`   Domain: ${domain}`);
      console.log(`   Verification Method: ${result.verificationMethod}`);
      console.log(`   Signature: ${result.signature.substring(0, 50)}...`);
      
      return result;
    } catch (error) {
      console.error(`❌ Badge signing failed: ${error.message}`);
      throw error;
    }
  }

  getIssuerUrlFromBadge(badgeData) {
    if (!badgeData || typeof badgeData !== 'object') return null;

    // Open Badges v3
    if (badgeData.issuer && typeof badgeData.issuer === 'object') {
      if (typeof badgeData.issuer.id === 'string') return badgeData.issuer.id;
      if (typeof badgeData.issuer.url === 'string') return badgeData.issuer.url;
    }

    // Open Badges v2
    if (typeof badgeData.issuer === 'string') return badgeData.issuer;
    if (badgeData.issuer && typeof badgeData.issuer.id === 'string') return badgeData.issuer.id;

    return null;
  }

  resolveLocalVerificationMethod(badgeData, { domain, issuerUrl, verificationMethod }) {
    if (verificationMethod) return verificationMethod;

    const issuerFromBadge = this.getIssuerUrlFromBadge(badgeData);
    const resolvedIssuerUrl = issuerUrl || issuerFromBadge;
    if (resolvedIssuerUrl) {
      return `${resolvedIssuerUrl.replace(/#.*$/, '').replace(/\/+$/, '')}#key`;
    }

    if (domain) {
      const host = this.normalizeDomain(domain);
      return `https://${host}/.well-known/openbadges-issuer.json#key`;
    }

    throw new Error('Unable to determine verification method. Provide --verification-method, --issuer-url, or <domain>');
  }

  signBadgeDataLocally(badgeData, privateKeyPem) {
    const canonicalData = JSON.stringify(badgeData, null, 0);
    const dataBuffer = Buffer.from(canonicalData, 'utf8');
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const signature = crypto.sign(null, dataBuffer, privateKey);
    return signature.toString('base64url');
  }

  async signBadgeLocal(badgeData, options = {}) {
    const { domain, privateKeyFile, issuerUrl, verificationMethod } = options;
    if (!privateKeyFile) {
      throw new Error('Local signing requires --private-key-file <path-to-private-key.pem>');
    }

    const resolvedKeyPath = path.resolve(privateKeyFile);
    const privateKeyPem = await fs.readFile(resolvedKeyPath, 'utf8');
    const resolvedVerificationMethod = this.resolveLocalVerificationMethod(badgeData, {
      domain,
      issuerUrl,
      verificationMethod
    });

    const signature = this.signBadgeDataLocally(badgeData, privateKeyPem);
    const signedBadge = {
      ...badgeData,
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        verificationMethod: resolvedVerificationMethod,
        proofPurpose: 'assertionMethod',
        jws: signature
      }
    };

    console.log('✅ Badge signed locally (no API key, no server signing key):');
    console.log(`   Verification Method: ${resolvedVerificationMethod}`);
    console.log(`   Signature: ${signature.substring(0, 50)}...`);

    return {
      message: 'Badge signed locally',
      signedBadge,
      signature,
      verificationMethod: resolvedVerificationMethod,
      mode: 'local'
    };
  }

  async generateWellKnownFile(issuerData) {
    console.log(`📄 Generating .well-known/openbadges-issuer.json file`);
    
    const { publicKey, privateKey } = this.generateKeyPair();
    
    // Convert PEM to multibase for Open Badges v3.0
    const publicKeyBuffer = crypto.createPublicKey(publicKey).export({
      type: 'spki',
      format: 'der'
    });
    const publicKeyMultibase = 'z' + publicKeyBuffer.toString('base64url');
    
    const wellKnownFile = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
      ],
      "id": `${issuerData.url}/.well-known/openbadges-issuer.json`,
      "type": "Profile",
      "name": issuerData.name,
      "url": issuerData.url,
      "email": issuerData.email,
      "description": issuerData.description || `Official issuer profile for ${issuerData.name}`,
      "official": true,
      "verified": true,
      "publicKey": {
        "id": `${issuerData.url}/.well-known/openbadges-issuer.json#key`,
        "type": "Ed25519VerificationKey2020",
        "controller": `${issuerData.url}/.well-known/openbadges-issuer.json`,
        "publicKeyMultibase": publicKeyMultibase
      }
    };
    
    // Save files
    const outputDir = './issuer-verification-files';
    await fs.mkdir(outputDir, { recursive: true });
    
    await fs.writeFile(
      path.join(outputDir, 'openbadges-issuer.json'),
      JSON.stringify(wellKnownFile, null, 2)
    );
    
    await fs.writeFile(
      path.join(outputDir, 'private-key.pem'),
      privateKey
    );
    
    await fs.writeFile(
      path.join(outputDir, 'public-key.pem'),
      publicKey
    );
    
    console.log(`✅ Generated verification files in ${outputDir}/:`);
    console.log(`   - openbadges-issuer.json (host at /.well-known/openbadges-issuer.json)`);
    console.log(`   - private-key.pem (keep secure!)`);
    console.log(`   - public-key.pem`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Host openbadges-issuer.json at ${issuerData.url}/.well-known/openbadges-issuer.json`);
    console.log(`   2. Run: badge-cli verify ${issuerData.url.replace(/https?:\/\//, '')}`);
    console.log(`   3. Keep private-key.pem secure for badge signing`);
    
    return {
      wellKnownFile,
      publicKey,
      privateKey,
      publicKeyMultibase
    };
  }
}

// CLI Commands
program
  .name('badge-cli')
  .description('CLI tool for managing Open Badges issuers and verification')
  .version('1.0.0');

program
  .command('config')
  .description('Configure CLI settings')
  .option('--api-key <key>', 'Set API key')
  .option('--base-url <url>', 'Set base URL')
  .option('--show', 'Show current configuration')
  .action(async (options) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    
    if (options.show) {
      console.log('Current configuration:');
      console.log(`  Base URL: ${cli.config.baseUrl}`);
      console.log(`  API Key: ${cli.config.apiKey ? '***configured***' : 'not set'}`);
      return;
    }
    
    if (options.apiKey) {
      cli.config.apiKey = options.apiKey;
      console.log('✅ API key updated');
    }
    
    if (options.baseUrl) {
      cli.config.baseUrl = options.baseUrl;
      console.log('✅ Base URL updated');
    }
    
    await cli.saveConfig();
  });

program
  .command('validate')
  .description('Validate an issuer domain locally (optional server policy check)')
  .argument('<url>', 'Issuer URL to validate')
  .option('--server-policy', 'Run server-side policy checks (requires API key)')
  .action(async (url, options) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    await cli.validateDomain(url, { serverPolicy: options.serverPolicy || false });
  });

program
  .command('create-issuer')
  .description('Create a new issuer')
  .requiredOption('-n, --name <name>', 'Issuer name')
  .requiredOption('-u, --url <url>', 'Issuer URL')
  .requiredOption('-e, --email <email>', 'Contact email')
  .option('-d, --description <desc>', 'Issuer description')
  .action(async (options) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    
    const issuerData = {
      id: `${options.url}/issuer`,
      name: options.name,
      url: options.url,
      email: options.email,
      description: options.description || `Official issuer for ${options.name}`
    };
    
    await cli.createIssuer(issuerData);
  });

program
  .command('create-badge')
  .description('Create a new badge class')
  .requiredOption('-n, --name <name>', 'Badge name')
  .requiredOption('-d, --description <desc>', 'Badge description')
  .requiredOption('-i, --issuer <url>', 'Issuer URL')
  .option('-c, --criteria <criteria>', 'Badge criteria')
  .action(async (options) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    
    const badgeData = {
      id: `${options.issuer}/badge/${Date.now()}`,
      name: options.name,
      description: options.description,
      issuer: options.issuer,
      criteria: options.criteria || `Criteria for earning ${options.name}`
    };
    
    await cli.createBadgeClass(badgeData);
  });

program
  .command('generate-keys')
  .description('Generate verification files for an organization')
  .requiredOption('-n, --name <name>', 'Organization name')
  .requiredOption('-u, --url <url>', 'Organization URL')
  .requiredOption('-e, --email <email>', 'Contact email')
  .option('-d, --description <desc>', 'Organization description')
  .action(async (options) => {
    const cli = new BadgeCLI();
    
    const issuerData = {
      name: options.name,
      url: options.url,
      email: options.email,
      description: options.description
    };
    
    await cli.generateWellKnownFile(issuerData);
  });

program
  .command('verify')
  .description('Verify an issuer domain (public check by default)')
  .argument('<domain>', 'Domain to verify (e.g., example.com)')
  .option('--log-trust', 'Persist verification result to server trust log (requires API key)')
  .option('--force', 'Force re-verification (only with --log-trust)')
  .action(async (domain, options) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    
    await cli.verifyIssuer(domain, {
      force: options.force || false,
      logTrust: options.logTrust || false
    });
  });

program
  .command('get-issuer')
  .description('Get issuer information (live check by default)')
  .argument('<domain>', 'Domain to look up')
  .option('--log-trust', 'Read stored issuer from server trust log (requires API key)')
  .action(async (domain, options) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    await cli.getVerifiedIssuer(domain, { logTrust: options.logTrust || false });
  });

program
  .command('test-connection')
  .description('Test connection to the badge API')
  .action(async () => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    
    console.log(`🔗 Testing connection to ${cli.config.baseUrl}`);
    
    try {
      await cli.makeRequest('/public/api/verify/json', {
        method: 'POST',
        body: JSON.stringify({})
      });
      console.log('✅ Connection successful!');
    } catch (error) {
      console.error(`❌ Connection failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('verify-badge')
  .description('Verify an Open Badge from URL or local JSON file')
  .argument('<badgeSource>', 'Badge URL or local JSON file path')
  .action(async (badgeSource) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    await cli.verifyBadge(badgeSource);
  });

program
  .command('verify-issuer-url')
  .description('Verify an Open Badges issuer by URL')
  .argument('<issuerUrl>', 'URL of the issuer to verify')
  .action(async (issuerUrl) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    await cli.verifyIssuerUrl(issuerUrl);
  });

program
  .command('sign-badge')
  .description('Sign a badge using server-managed keys or local private key (--local)')
  .argument('<badgeFile>', 'Path to badge JSON file to sign')
  .argument('[domain]', 'Domain of the issuer for key lookup')
  .option('--local', 'Sign locally with a provided private key (no API key required)')
  .option('--private-key-file <file>', 'Path to local Ed25519 private key PEM file (required with --local)')
  .option('--issuer-url <url>', 'Issuer profile URL to derive verificationMethod for --local')
  .option('--verification-method <url>', 'Explicit verificationMethod URL for --local')
  .option('--output <file>', 'Output file for signed badge (optional)')
  .action(async (badgeFile, domain, options) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    
    try {
      // Read the badge file
      const badgeData = JSON.parse(await fs.readFile(badgeFile, 'utf8'));
      
      let result;
      if (options.local) {
        result = await cli.signBadgeLocal(badgeData, {
          domain,
          privateKeyFile: options.privateKeyFile,
          issuerUrl: options.issuerUrl,
          verificationMethod: options.verificationMethod
        });
      } else {
        if (!domain) {
          throw new Error('Domain is required for server signing mode. Use --local with --private-key-file for local signing.');
        }
        result = await cli.signBadge(badgeData, domain);
      }
      
      // Save signed badge
      const outputFile = options.output || badgeFile.replace('.json', '-signed.json');
      await fs.writeFile(outputFile, JSON.stringify(result.signedBadge, null, 2));
      
      console.log(`💾 Signed badge saved to: ${outputFile}`);
    } catch (error) {
      console.error(`❌ Failed to sign badge: ${error.message}`);
      process.exit(1);
    }
  });

export { BadgeCLI };

// Parse command line arguments when run directly (handles symlinks/npm bin shims)
if (process.argv[1]) {
  const realArgv = realpathSync(process.argv[1]);
  const realSelf = fileURLToPath(import.meta.url);
  if (realArgv === realSelf) {
    program.parse();
  }
}
