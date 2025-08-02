#!/usr/bin/env node

import { program } from 'commander';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const DEFAULT_BASE_URL = process.env.BADGE_CLI_BASE_URL || 'http://localhost:3000';
const CONFIG_FILE = path.join(process.cwd(), '.badge-cli-config.json');

class BadgeCLI {
  constructor() {
    this.config = {};
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

  async makeRequest(endpoint, options = {}) {
    if (!this.config.apiKey) {
      throw new Error('API key not configured. Run: badge-cli config --api-key YOUR_KEY');
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const requestOptions = {
      headers: {
        'X-API-Key': this.config.apiKey,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    const response = await fetch(url, requestOptions);
    const data = await response.json();

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

  async validateDomain(url) {
    console.log(`🔍 Validating domain: ${url}`);
    
    try {
      const result = await this.makeRequest(`/api/validate-issuer-domain?url=${encodeURIComponent(url)}`);
      
      console.log(`✅ Domain validation result:`);
      console.log(`   Type: ${result.type}`);
      console.log(`   Valid: ${result.valid}`);
      console.log(`   Message: ${result.message}`);
      
      if (result.warnings && result.warnings.length > 0) {
        console.log(`⚠️  Warnings:`);
        result.warnings.forEach(warning => console.log(`   - ${warning}`));
      }
      
      return result;
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
      });
      
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
      });
      
      console.log(`✅ Badge class created successfully:`);
      console.log(`   Filename: ${result.filename}`);
      console.log(`   URL: ${result.url}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Badge class creation failed: ${error.message}`);
      throw error;
    }
  }

  async verifyIssuer(domain, verificationData) {
    console.log(`🔐 Verifying issuer for domain: ${domain}`);
    
    try {
      const result = await this.makeRequest('/api/issuers/verify', {
        method: 'POST',
        body: JSON.stringify({
          domain,
          ...verificationData
        })
      });
      
      console.log(`✅ Issuer verification completed:`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Message: ${result.message}`);
      
      if (result.verificationDetails) {
        console.log(`📋 Verification Details:`);
        Object.entries(result.verificationDetails).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Issuer verification failed: ${error.message}`);
      throw error;
    }
  }

  async getVerifiedIssuer(domain) {
    console.log(`📋 Getting verified issuer info for: ${domain}`);
    
    try {
      const result = await this.makeRequest(`/api/issuers/${encodeURIComponent(domain)}`);
      
      console.log(`✅ Verified issuer found:`);
      console.log(`   Name: ${result.displayName}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Verified: ${result.verified ? 'Yes' : 'No'}`);
      console.log(`   Added: ${new Date(result.dateAdded).toLocaleDateString()}`);
      
      if (result.profileUrl) {
        console.log(`   Profile URL: ${result.profileUrl}`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to get verified issuer: ${error.message}`);
      throw error;
    }
  }

  async verifyBadge(badgeUrl) {
    console.log(`🔍 Verifying badge: ${badgeUrl}`);
    
    try {
      const result = await this.makeRequest(`/api/verify/badge/${encodeURIComponent(badgeUrl)}`);
      
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
      console.log(`   Badge URL: ${badgeUrl}`);
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
      const result = await this.makeRequest(`/api/verify/issuer/${encodeURIComponent(issuerUrl)}`);
      
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
      });
      
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

  async generateWellKnownFile(issuerData) {
    console.log(`📄 Generating .well-known/issuer.json file`);
    
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
      "id": `${issuerData.url}/.well-known/issuer.json`,
      "type": "Profile",
      "name": issuerData.name,
      "url": issuerData.url,
      "email": issuerData.email,
      "description": issuerData.description || `Official issuer profile for ${issuerData.name}`,
      "official": true,
      "verified": true,
      "publicKey": {
        "id": `${issuerData.url}/.well-known/issuer.json#key`,
        "type": "Ed25519VerificationKey2020",
        "controller": `${issuerData.url}/.well-known/issuer.json`,
        "publicKeyMultibase": publicKeyMultibase
      }
    };
    
    // Save files
    const outputDir = './issuer-verification-files';
    await fs.mkdir(outputDir, { recursive: true });
    
    await fs.writeFile(
      path.join(outputDir, 'issuer.json'),
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
    console.log(`   - issuer.json (host at /.well-known/issuer.json)`);
    console.log(`   - private-key.pem (keep secure!)`);
    console.log(`   - public-key.pem`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Host issuer.json at ${issuerData.url}/.well-known/issuer.json`);
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
  .description('Validate an issuer domain')
  .argument('<url>', 'Issuer URL to validate')
  .action(async (url) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    await cli.validateDomain(url);
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
  .description('Verify an issuer domain')
  .argument('<domain>', 'Domain to verify (e.g., example.com)')
  .option('--force', 'Force re-verification')
  .action(async (domain, options) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    
    const verificationData = {
      force: options.force || false
    };
    
    await cli.verifyIssuer(domain, verificationData);
  });

program
  .command('get-issuer')
  .description('Get verified issuer information')
  .argument('<domain>', 'Domain to look up')
  .action(async (domain) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    await cli.getVerifiedIssuer(domain);
  });

program
  .command('test-connection')
  .description('Test connection to the badge API')
  .action(async () => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    
    console.log(`🔗 Testing connection to ${cli.config.baseUrl}`);
    
    try {
      await cli.validateDomain('https://demo.example.org/test');
      console.log('✅ Connection successful!');
    } catch (error) {
      console.error(`❌ Connection failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('verify-badge')
  .description('Verify the authenticity and structure of an Open Badge')
  .argument('<badgeUrl>', 'URL of the badge to verify')
  .action(async (badgeUrl) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    await cli.verifyBadge(badgeUrl);
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
  .description('Cryptographically sign a badge with issuer keys')
  .argument('<badgeFile>', 'Path to badge JSON file to sign')
  .argument('<domain>', 'Domain of the issuer for key lookup')
  .option('--output <file>', 'Output file for signed badge (optional)')
  .action(async (badgeFile, domain, options) => {
    const cli = new BadgeCLI();
    await cli.loadConfig();
    
    try {
      // Read the badge file
      const badgeData = JSON.parse(await fs.readFile(badgeFile, 'utf8'));
      
      // Sign the badge
      const result = await cli.signBadge(badgeData, domain);
      
      // Save signed badge
      const outputFile = options.output || badgeFile.replace('.json', '-signed.json');
      await fs.writeFile(outputFile, JSON.stringify(result.signedBadge, null, 2));
      
      console.log(`💾 Signed badge saved to: ${outputFile}`);
    } catch (error) {
      console.error(`❌ Failed to sign badge: ${error.message}`);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();