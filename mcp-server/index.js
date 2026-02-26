#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { z } from 'zod';

// Configuration
const DEFAULT_BASE_URL = process.env.BADGE_BASE_URL || 'http://localhost:3000';
const DEFAULT_API_KEY = process.env.BADGE_API_KEY || '';
const SAFE_TEST_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
  'test.example.com',
  'demo.example.org',
  'localhost',
  '127.0.0.1'
];

// Validation schemas
const IssuerSchema = z.object({
  id: z.string().url(),
  name: z.string(),
  url: z.string().url(),
  email: z.string().email().optional(),
  description: z.string().optional(),
  image: z.string().url().optional(),
});

const BadgeClassSchema = z.object({
  id: z.string().url(),
  name: z.string(),
  description: z.string(),
  image: z.string().url().optional(),
  criteria: z.string(),
  issuer: z.string().url(),
  tags: z.array(z.string()).optional(),
});

const CredentialSubjectSchema = z.object({
  id: z.string().url(),
  recipient: z.object({
    type: z.string(),
    hashed: z.boolean(),
    identity: z.string(),
  }),
  badge: z.string().url(),
  issuedOn: z.string().optional(),
  expires: z.string().optional(),
  evidence: z.string().url().optional(),
});

const VerifyIssuerDomainSchema = z.object({
  domain: z.string().min(1),
  logTrust: z.boolean().optional(),
  force: z.boolean().optional(),
});

const ValidateIssuerDomainSchema = z.object({
  url: z.string().url(),
  serverPolicy: z.boolean().optional(),
});

const VerifyBadgeJsonSchema = z.object({
  badgeData: z.record(z.any()),
});

const GenerateIssuerTemplateSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  email: z.string().email().optional(),
  description: z.string().optional(),
  publicKeyMultibase: z.string().optional()
});

const IssueSampleBadgeSchema = z.object({
  learnerName: z.string().min(1).optional(),
  sourceUrl: z.string().url().optional(),
  summary: z.string().min(12),
  proficiency: z.string().optional(),
  skills: z.array(z.string()).optional(),
  badgeName: z.string().optional()
});

const ExplainVerificationResultSchema = z.object({
  verification: z.record(z.any())
});

class BadgeGeneratorMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'badge-generator-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.baseUrl = DEFAULT_BASE_URL;
    this.apiKey = DEFAULT_API_KEY;
    this.isConfigured = DEFAULT_BASE_URL !== 'http://localhost:3000' || !!DEFAULT_API_KEY;
    
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_issuer',
            description: 'Create a new Open Badges issuer/profile',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uri',
                  description: 'Unique identifier URL for the issuer',
                },
                name: {
                  type: 'string',
                  description: 'Name of the issuing organization',
                },
                url: {
                  type: 'string',
                  format: 'uri',
                  description: 'Website URL of the issuing organization',
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'Contact email (optional)',
                },
                description: {
                  type: 'string',
                  description: 'Description of the issuing organization (optional)',
                },
                image: {
                  type: 'string',
                  format: 'uri',
                  description: 'Logo/image URL (optional)',
                },
              },
              required: ['id', 'name', 'url'],
            },
          },
          {
            name: 'create_badge_class',
            description: 'Create a new Open Badges badge class/achievement',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uri',
                  description: 'Unique identifier URL for the badge class',
                },
                name: {
                  type: 'string',
                  description: 'Name of the badge',
                },
                description: {
                  type: 'string',
                  description: 'Description of what the badge represents',
                },
                image: {
                  type: 'string',
                  format: 'uri',
                  description: 'Badge image URL (optional)',
                },
                criteria: {
                  type: 'string',
                  description: 'Criteria for earning the badge',
                },
                issuer: {
                  type: 'string',
                  format: 'uri',
                  description: 'URL of the issuer who created this badge class',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tags for categorizing the badge (optional)',
                },
              },
              required: ['id', 'name', 'description', 'criteria', 'issuer'],
            },
          },
          {
            name: 'create_credential_subject',
            description: 'Create a new Open Badges assertion/credential for a recipient',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uri',
                  description: 'Unique identifier URL for the credential',
                },
                recipient: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      description: 'Type of recipient identifier (e.g., "email")',
                    },
                    hashed: {
                      type: 'boolean',
                      description: 'Whether the identity is hashed',
                    },
                    identity: {
                      type: 'string',
                      description: 'Recipient identifier (email, etc.)',
                    },
                  },
                  required: ['type', 'hashed', 'identity'],
                },
                badge: {
                  type: 'string',
                  format: 'uri',
                  description: 'URL of the badge class being awarded',
                },
                issuedOn: {
                  type: 'string',
                  format: 'date-time',
                  description: 'When the badge was issued (optional, defaults to now)',
                },
                expires: {
                  type: 'string',
                  format: 'date-time',
                  description: 'When the badge expires (optional)',
                },
                evidence: {
                  type: 'string',
                  format: 'uri',
                  description: 'URL to evidence supporting the badge award (optional)',
                },
              },
              required: ['id', 'recipient', 'badge'],
            },
          },
          {
            name: 'list_badges',
            description: 'List all uploaded badge files',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_badge',
            description: 'Retrieve a specific badge file by filename',
            inputSchema: {
              type: 'object',
              properties: {
                filename: {
                  type: 'string',
                  description: 'Name of the badge file to retrieve',
                },
              },
              required: ['filename'],
            },
          },
          {
            name: 'test_server',
            description: 'Test the connection to the Badge Generator server and show current configuration',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'validate_issuer_domain',
            description: 'Validate an issuer URL locally (optionally check server policy with API key)',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  format: 'uri',
                  description: 'Issuer URL to validate',
                },
                serverPolicy: {
                  type: 'boolean',
                  description: 'If true, also query authenticated /api/validate-issuer-domain (requires API key)',
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'configure_server',
            description: 'Configure MCP server connection settings (API key optional for public-only flows)',
            inputSchema: {
              type: 'object',
              properties: {
                baseUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'Base URL of the Badge Generator API',
                },
                apiKey: {
                  type: 'string',
                  description: 'API key for authenticated admin/write operations (optional)',
                },
              },
              required: ['baseUrl'],
            },
          },
          {
            name: 'verify_badge',
            description: 'Verify a remote Open Badge URL via public verifier endpoint (no API key required)',
            inputSchema: {
              type: 'object',
              properties: {
                badgeUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'URL of the badge to verify',
                },
              },
              required: ['badgeUrl'],
            },
          },
          {
            name: 'verify_issuer',
            description: 'Verify an issuer profile URL via public verifier endpoint (no API key required)',
            inputSchema: {
              type: 'object',
              properties: {
                issuerUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'URL of the issuer to verify',
                },
              },
              required: ['issuerUrl'],
            },
          },
          {
            name: 'verify_badge_json',
            description: 'Verify inline badge JSON via public verifier endpoint (no API key required)',
            inputSchema: {
              type: 'object',
              properties: {
                badgeData: {
                  type: 'object',
                  description: 'Badge JSON object to verify',
                },
              },
              required: ['badgeData'],
            },
          },
          {
            name: 'verify_issuer_domain',
            description: 'Verify issuer domain via well-known profile; optionally write trust record',
            inputSchema: {
              type: 'object',
              properties: {
                domain: {
                  type: 'string',
                  description: 'Domain or URL for issuer verification',
                },
                logTrust: {
                  type: 'boolean',
                  description: 'When true (default), writes verified issuer to trust log',
                },
                force: {
                  type: 'boolean',
                  description: 'Force re-verification (requires API key admin endpoint)',
                },
              },
              required: ['domain'],
            },
          },
          {
            name: 'generate_issuer_profile_template',
            description: 'Generate a ready-to-host /.well-known/openbadges-issuer.json template and key instructions',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Issuer display name'
                },
                url: {
                  type: 'string',
                  format: 'uri',
                  description: 'Issuer website URL'
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'Contact email (optional)'
                },
                description: {
                  type: 'string',
                  description: 'Issuer description (optional)'
                },
                publicKeyMultibase: {
                  type: 'string',
                  description: 'Optional Ed25519 public key multibase (z...)'
                }
              },
              required: ['name', 'url']
            }
          },
          {
            name: 'issue_sample_badge',
            description: 'Create a signed demo badge using the public prompt-to-badge endpoint (no API key required)',
            inputSchema: {
              type: 'object',
              properties: {
                learnerName: {
                  type: 'string',
                  description: 'Recipient display name (optional)'
                },
                sourceUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'Optional source evidence URL'
                },
                summary: {
                  type: 'string',
                  description: 'Assessment summary (minimum 12 chars)'
                },
                proficiency: {
                  type: 'string',
                  description: 'beginner | intermediate | advanced | expert (optional)'
                },
                skills: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Skill tags (optional)'
                },
                badgeName: {
                  type: 'string',
                  description: 'Badge title (optional)'
                }
              },
              required: ['summary']
            }
          },
          {
            name: 'explain_verification_result',
            description: 'Translate verifier JSON into a plain-language trust explanation with next steps',
            inputSchema: {
              type: 'object',
              properties: {
                verification: {
                  type: 'object',
                  description: 'Verification JSON result from verify_badge/verify_badge_json/verify_issuer'
                }
              },
              required: ['verification']
            }
          },
          {
            name: 'sign_badge',
            description: 'Cryptographically sign badge data using server-managed issuer keys (requires API key)',
            inputSchema: {
              type: 'object',
              properties: {
                badgeData: {
                  type: 'object',
                  description: 'Badge data to sign (JSON object)',
                },
                domain: {
                  type: 'string',
                  description: 'Domain of the issuer for key lookup',
                },
              },
              required: ['badgeData', 'domain'],
            },
          },
          {
            name: 'cache_public_key',
            description: 'Cache a public key from a verified issuer for verification',
            inputSchema: {
              type: 'object',
              properties: {
                issuerUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'URL of the issuer to cache public key from',
                },
              },
              required: ['issuerUrl'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'test_server':
            return await this.testServer();
          case 'validate_issuer_domain':
            return await this.validateIssuerDomain(args);
          case 'configure_server':
            return await this.configureServer(args);
          case 'create_issuer':
            return await this.createIssuer(args);
          case 'create_badge_class':
            return await this.createBadgeClass(args);
          case 'create_credential_subject':
            return await this.createCredentialSubject(args);
          case 'list_badges':
            return await this.listBadges();
          case 'get_badge':
            return await this.getBadge(args);
          case 'verify_badge':
            return await this.verifyBadge(args);
          case 'verify_issuer':
            return await this.verifyIssuer(args);
          case 'verify_badge_json':
            return await this.verifyBadgeJson(args);
          case 'verify_issuer_domain':
            return await this.verifyIssuerDomain(args);
          case 'generate_issuer_profile_template':
            return await this.generateIssuerProfileTemplate(args);
          case 'issue_sample_badge':
            return await this.issueSampleBadge(args);
          case 'explain_verification_result':
            return await this.explainVerificationResult(args);
          case 'sign_badge':
            return await this.signBadge(args);
          case 'cache_public_key':
            return await this.cachePublicKey(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  normalizeDomainInput(domainInput) {
    const raw = String(domainInput || '').trim();
    if (!raw) {
      throw new Error('Domain is required');
    }

    let host = raw;
    if (raw.includes('://')) {
      host = new URL(raw).host;
    } else {
      host = raw.split('/')[0];
    }

    host = host.trim().toLowerCase();
    if (!host) {
      throw new Error('Invalid domain format');
    }

    const parsed = new URL(`https://${host}`);
    return parsed.host.toLowerCase();
  }

  buildWellKnownIssuerUrl(domainInput) {
    const host = this.normalizeDomainInput(domainInput);
    return `https://${host}/.well-known/openbadges-issuer.json`;
  }

  localValidateIssuerDomain(url) {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol.toLowerCase();

    if (protocol !== 'http:' && protocol !== 'https:') {
      return {
        valid: false,
        type: 'invalid',
        message: 'Only http and https URLs are supported',
        warnings: []
      };
    }

    const isSafeDomain = SAFE_TEST_DOMAINS.some((safe) => hostname === safe || hostname.endsWith(`.${safe}`));
    if (isSafeDomain) {
      return {
        valid: true,
        type: 'testing',
        message: 'Safe testing domain',
        warnings: ['Using example/local domain intended for testing']
      };
    }

    return {
      valid: true,
      type: 'unverified',
      message: 'URL format is valid (local check only)',
      warnings: ['No trust log read/write performed in local validation mode']
    };
  }

  async requestJson(endpoint, options = {}, requestConfig = {}) {
    const { requireApiKey = false } = requestConfig;
    if (requireApiKey && !this.apiKey) {
      throw new Error('API key not configured. Use configure_server or BADGE_API_KEY for authenticated operations.');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };

    if (!response.ok) {
      const detail = data.error || data.message || response.statusText;
      throw new Error(`${response.status} ${detail}`);
    }

    return data;
  }

  async testServer() {
    let connectionStatus = '❌ Not tested';
    let errorMessage = '';
    
    try {
      // Test basic connectivity by trying to fetch the homepage with HEAD request
      const response = await fetch(`${this.baseUrl}/`, { 
        method: 'HEAD'
      });
      
      if (response.ok) {
        connectionStatus = '✅ Connected';
      } else {
        connectionStatus = `⚠️ Server responded with ${response.status}`;
      }
    } catch (error) {
      connectionStatus = '❌ Connection failed';
      errorMessage = error.message;
    }
    
    const usingDefaultBase = this.baseUrl === 'http://localhost:3000';
    const configStatus = usingDefaultBase ? '⚠️ Using default base URL' : '✅ Base URL configured';
    
    return {
      content: [
        {
          type: 'text',
          text: `🔧 Badge Generator MCP Server Status\n\n` +
                `Configuration: ${configStatus}\n` +
                `Base URL: ${this.baseUrl}\n` +
                `API Key: ${this.apiKey ? '[SET]' : '[NOT SET]'}\n` +
                `Connection: ${connectionStatus}\n` +
                `${errorMessage ? `Error: ${errorMessage}\n` : ''}\n` +
                `${usingDefaultBase ? '💡 Tip: Set BADGE_BASE_URL or use configure_server to target your deployed instance.\n' : ''}` +
                `${!this.apiKey ? 'ℹ️ No API key set. Public verification tools work, authenticated issue/sign tools are disabled.\n' : ''}`,
        },
      ],
    };
  }

  async validateIssuerDomain(args) {
    const { url, serverPolicy = false } = ValidateIssuerDomainSchema.parse(args || {});
    const localValidation = this.localValidateIssuerDomain(url);

    const typeInfo = {
      verified: '🔒 Verified (production-ready)',
      'verified-external': '🔒 Verified external issuer',
      testing: '🧪 Testing domain (safe for demos)',
      unverified: '⚠️ Unverified domain',
      'verification-failed': '⚠️ Verification failed',
      unregistered: '⚠️ Unregistered domain',
      invalid: '❌ Invalid URL format'
    };

    const localStatusIcon = localValidation.valid ? '✅' : '❌';
    let localWarningsText = '';
    if (localValidation.warnings && localValidation.warnings.length > 0) {
      localWarningsText = `\n\n⚠️ Local warnings:\n${localValidation.warnings.map((w) => `• ${w}`).join('\n')}`;
    }

    if (!serverPolicy) {
      return {
        content: [
          {
            type: 'text',
            text: `${localStatusIcon} Local Domain Validation: ${url}\n\n` +
              `Status: ${typeInfo[localValidation.type] || localValidation.type}\n` +
              `Message: ${localValidation.message}\n` +
              `Server Policy Checked: No${localWarningsText}`
          }
        ]
      };
    }

    const serverValidation = await this.requestJson(
      `/api/validate-issuer-domain?url=${encodeURIComponent(url)}`,
      {},
      { requireApiKey: true }
    );
    const serverStatusIcon = serverValidation.valid ? '✅' : '❌';
    let serverWarningsText = '';
    if (serverValidation.warnings && serverValidation.warnings.length > 0) {
      serverWarningsText = `\n\n⚠️ Server warnings:\n${serverValidation.warnings.map((w) => `• ${w}`).join('\n')}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: `${localStatusIcon} Local Domain Validation: ${url}\n\n` +
            `Status: ${typeInfo[localValidation.type] || localValidation.type}\n` +
            `Message: ${localValidation.message}${localWarningsText}\n\n` +
            `${serverStatusIcon} Server Policy Validation:\n` +
            `Status: ${typeInfo[serverValidation.type] || serverValidation.type}\n` +
            `Message: ${serverValidation.message}\n` +
            `Production Ready: ${serverValidation.type === 'verified' ? 'Yes' : 'No'}${serverWarningsText}`
        }
      ]
    };
  }

  async configureServer(args) {
    const { baseUrl, apiKey } = args;
    this.baseUrl = baseUrl;
    if (typeof apiKey === 'string') {
      this.apiKey = apiKey;
    }
    this.isConfigured = true;
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Server configured successfully!\nBase URL: ${baseUrl}\nAPI Key: ${this.apiKey ? '[SET]' : '[NOT SET]'}\n\n💡 Public verification tools work without API key. Authenticated issue/sign tools require BADGE_API_KEY or configure_server.apiKey.`,
        },
      ],
    };
  }

  async createIssuer(args) {
    if (!this.apiKey) {
      throw new Error('API key not configured. Use test_server to check configuration or configure_server to set credentials.');
    }
    
    const validatedData = IssuerSchema.parse(args);
    
    const response = await fetch(`${this.baseUrl}/api/issuer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    let warningsText = '';
    if (result.warnings && result.warnings.length > 0) {
      warningsText = `\n\n⚠️ Warnings:\n${result.warnings.map(w => `• ${w}`).join('\n')}`;
    }
    
    let domainInfoText = '';
    if (result.domain_info) {
      const productionReady = result.domain_info.is_production_ready ? '✅ Yes' : '❌ No';
      domainInfoText = `\n\nDomain Info:\n• Type: ${result.domain_info.type}\n• Message: ${result.domain_info.message}\n• Production Ready: ${productionReady}`;
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Issuer created successfully!\n\nFilename: ${result.filename}\nURL: ${result.url}${warningsText}${domainInfoText}\n\nIssuer Details:\n${JSON.stringify(result.issuer, null, 2)}`,
        },
      ],
    };
  }

  async createBadgeClass(args) {
    if (!this.apiKey) {
      throw new Error('API key not configured. Use test_server to check configuration or configure_server to set credentials.');
    }
    
    const validatedData = BadgeClassSchema.parse(args);
    
    const response = await fetch(`${this.baseUrl}/api/badge-class`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Badge Class created successfully!\n\nFilename: ${result.filename}\nURL: ${result.url}\n\nBadge Class Details:\n${JSON.stringify(result.badgeClass, null, 2)}`,
        },
      ],
    };
  }

  async createCredentialSubject(args) {
    if (!this.apiKey) {
      throw new Error('API key not configured. Use test_server to check configuration or configure_server to set credentials.');
    }
    
    const validatedData = CredentialSubjectSchema.parse(args);
    
    const response = await fetch(`${this.baseUrl}/api/credential-subject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Credential Subject created successfully!\n\nFilename: ${result.filename}\nURL: ${result.url}\n\nCredential Details:\n${JSON.stringify(result.credentialSubject, null, 2)}`,
        },
      ],
    };
  }

  async listBadges() {
    if (!this.apiKey) {
      throw new Error('API key not configured. Use test_server to check configuration or configure_server to set credentials.');
    }

    const response = await fetch(`${this.baseUrl}/api/badge-files`, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      // Fallback to informative message if endpoint doesn't exist yet
      if (response.status === 404) {
        return {
          content: [
            {
              type: 'text',
              text: `📋 Badge File Listing\n\n` +
                    `❌ Server does not support API-authenticated file listing yet.\n` +
                    `The /api/badge-files endpoint is not available.\n\n` +
                    `🔧 Alternative approaches:\n` +
                    `• Use get_badge with specific filenames\n` +
                    `• Check the public badges directory at ${this.baseUrl}/badges\n` +
                    `• Recently created files follow these patterns:\n` +
                    `  - issuer-[timestamp].json\n` +
                    `  - badge-class-[timestamp].json\n` +
                    `  - credential-[timestamp].json\n\n` +
                    `💡 Tip: The create_* tools return the exact filename and URL of created badges.`,
            },
          ],
        };
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const files = await response.json();
    
    const fileList = files.map(file => `• ${file.name} - ${file.fullUrl || this.baseUrl + file.url}`).join('\n');
    
    return {
      content: [
        {
          type: 'text',
          text: `📋 Badge Files (${files.length} total):\n\n${fileList || 'No files found.'}`,
        },
      ],
    };
  }

  async getBadge(args) {
    const { filename } = args;
    
    const response = await fetch(`${this.baseUrl}/badges/${filename}`);

    if (!response.ok) {
      throw new Error(`Badge file not found: ${filename}`);
    }

    const badgeData = await response.json();
    
    return {
      content: [
        {
          type: 'text',
          text: `📄 Badge File: ${filename}\n\n${JSON.stringify(badgeData, null, 2)}`,
        },
      ],
    };
  }

  extractPublicKeyPem(maybeKey) {
    if (!maybeKey) return null;
    if (typeof maybeKey === 'string') {
      return maybeKey.includes('BEGIN PUBLIC KEY') ? maybeKey : null;
    }
    if (typeof maybeKey !== 'object') return null;
    if (typeof maybeKey.publicKeyPem === 'string') {
      return maybeKey.publicKeyPem;
    }
    if (typeof maybeKey.publicKeyMultibase === 'string' && maybeKey.publicKeyMultibase.startsWith('z')) {
      try {
        const keyBuffer = Buffer.from(maybeKey.publicKeyMultibase.slice(1), 'base64url');
        return crypto.createPublicKey({
          key: keyBuffer,
          format: 'der',
          type: 'spki'
        }).export({ type: 'spki', format: 'pem' }).toString();
      } catch {
        return null;
      }
    }
    return null;
  }

  computeKeyFingerprint(publicKeyPem) {
    if (!publicKeyPem) return null;
    try {
      const keyDer = crypto.createPublicKey(publicKeyPem).export({
        type: 'spki',
        format: 'der'
      });
      const digest = crypto.createHash('sha256').update(keyDer).digest('hex');
      return `sha256:${digest}`;
    } catch {
      return null;
    }
  }

  formatTrustSummary(result) {
    const trustState = result?.trustState || 'UNVERIFIED';
    const issuerDomain = result?.issuerDomain || result?.verification?.issuerDomain || result?.issuer?.domain || 'unknown';
    const validationLabel = result?.validationLabel || result?.verification?.validationLabel ||
      (this.isDemoDomain(issuerDomain) ? 'DEMO' : null);
    const keyFingerprint = result?.keyFingerprint ||
      result?.verification?.keyFingerprint ||
      result?.signature?.keyFingerprint ||
      result?.issuer?.publicKeyFingerprint ||
      this.computeKeyFingerprint(this.extractPublicKeyPem(result?.verification?.issuer?.publicKey));
    const reason = result?.verificationReason || 'Issuer cannot be cryptographically verified.';

    return [
      `• Trust State: ${trustState}`,
      `• Issuer Domain: ${issuerDomain}`,
      `• Validation Label: ${validationLabel || 'none'}`,
      `• Key Fingerprint: ${keyFingerprint || 'not available'}`,
      `• Reason: ${reason}`
    ].join('\n');
  }

  isDemoDomain(domain) {
    if (!domain) return false;
    try {
      const parsed = new URL(String(domain).includes('://') ? domain : `https://${domain}`);
      const hostname = parsed.hostname.toLowerCase();
      return hostname === 'example.com' || hostname.endsWith('.example.com');
    } catch {
      return false;
    }
  }

  async verifyBadge(args) {
    const { badgeUrl } = args;
    const verification = await this.requestJson(`/public/api/verify/badge/${encodeURIComponent(badgeUrl)}`);
    
    // Format verification levels with emojis
    const levelEmojis = {
      'cryptographically_verified': '🔐 Cryptographically Verified',
      'fully_verified': '✅ Fully Verified',
      'remote_verified': '🌐 Remote Verified',
      'basic_verified': '📋 Basic Verified',
      'structure_only': '📝 Structure Only',
      'structure_valid_issuer_invalid': '⚠️ Structure Valid, Issuer Invalid',
      'invalid': '❌ Invalid'
    };
    
    const verificationLevel = levelEmojis[verification.verificationLevel] || verification.verificationLevel;
    const overallStatus = verification.valid ? '✅ VALID' : '❌ INVALID';
    
    let detailsText = `\n\n🔍 Verification Details:\n`;
    detailsText += `• Badge Version: ${verification.version}\n`;
    detailsText += `• Verification Level: ${verificationLevel}\n`;
    detailsText += `${this.formatTrustSummary(verification)}\n`;
    
    // Structure validation details
    if (verification.structure) {
      const structStatus = verification.structure.valid ? '✅' : '❌';
      detailsText += `• Structure: ${structStatus} ${verification.structure.valid ? 'Valid' : 'Invalid'}\n`;
      if (verification.structure.errors && verification.structure.errors.length > 0) {
        detailsText += `  Errors: ${verification.structure.errors.join(', ')}\n`;
      }
      if (verification.structure.warnings && verification.structure.warnings.length > 0) {
        detailsText += `  Warnings: ${verification.structure.warnings.join(', ')}\n`;
      }
    }
    
    // Issuer verification details
    if (verification.issuer) {
      const issuerStatus = verification.issuer.valid ? '✅' : '❌';
      detailsText += `• Issuer: ${issuerStatus} ${verification.issuer.message || (verification.issuer.valid ? 'Valid' : 'Invalid')}\n`;
      if (verification.issuer.type) {
        detailsText += `  Type: ${verification.issuer.type}\n`;
      }
    }
    
    // Signature verification details
    if (verification.signature) {
      const sigStatus = verification.signature.valid ? '🔐' : '❌';
      detailsText += `• Signature: ${sigStatus} ${verification.signature.message || (verification.signature.valid ? 'Valid' : 'Invalid')}\n`;
      if (verification.signature.signatureType) {
        detailsText += `  Type: ${verification.signature.signatureType}\n`;
      }
    } else {
      detailsText += `• Signature: ➖ No cryptographic signature found\n`;
    }
    
    detailsText += `\n⏰ Verified at: ${verification.verifiedAt}`;
    
    return {
      content: [
        {
          type: 'text',
          text: `🔍 Badge Verification Results\n\n${overallStatus}\nBadge URL: ${badgeUrl}${detailsText}`,
        },
      ],
    };
  }

  async verifyIssuer(args) {
    const { issuerUrl } = args;
    const result = await this.requestJson(`/public/api/verify/issuer/${encodeURIComponent(issuerUrl)}`);
    const verification = result.verification;
    
    const overallStatus = verification.valid ? '✅ VALID' : '❌ INVALID';
    
    let detailsText = `\n\n🔍 Issuer Verification Details:\n`;
    detailsText += `• Status: ${verification.valid ? 'Valid' : 'Invalid'}\n`;
    detailsText += `• Type: ${verification.type || 'Unknown'}\n`;
    detailsText += `• Message: ${verification.message || 'No message'}\n`;
    detailsText += `${this.formatTrustSummary(result)}\n`;
    
    if (verification.issuer) {
      detailsText += `\n📋 Issuer Information:\n`;
      detailsText += `• Name: ${verification.issuer.name || 'Unknown'}\n`;
      detailsText += `• ID: ${verification.issuer.id || 'Unknown'}\n`;
      if (verification.issuer.url) {
        detailsText += `• URL: ${verification.issuer.url}\n`;
      }
      if (verification.issuer.email) {
        detailsText += `• Email: ${verification.issuer.email}\n`;
      }
    }
    
    if (verification.error) {
      detailsText += `\n❌ Error: ${verification.error}\n`;
    }
    
    detailsText += `\n⏰ Verified at: ${result.verifiedAt}`;
    
    return {
      content: [
        {
          type: 'text',
          text: `🔍 Issuer Verification Results\n\n${overallStatus}\nIssuer URL: ${issuerUrl}${detailsText}`,
        },
      ],
    };
  }

  async verifyBadgeJson(args) {
    const { badgeData } = VerifyBadgeJsonSchema.parse(args || {});
    const verification = await this.requestJson('/public/api/verify/json', {
      method: 'POST',
      body: JSON.stringify({ badgeData })
    });

    const overallStatus = verification.valid ? '✅ VALID' : '❌ INVALID';
    return {
      content: [
        {
          type: 'text',
          text: `🔍 Inline Badge JSON Verification\n\n${overallStatus}\n` +
            `Version: ${verification.version}\n` +
            `Verification Level: ${verification.verificationLevel}\n` +
            `${this.formatTrustSummary(verification)}\n` +
            `Verified At: ${verification.verifiedAt}\n\n` +
            `${JSON.stringify(verification, null, 2)}`
        }
      ]
    };
  }

  async verifyIssuerDomain(args) {
    const { domain, logTrust = true, force = false } = VerifyIssuerDomainSchema.parse(args || {});
    const normalizedDomain = this.normalizeDomainInput(domain);
    const issuerUrl = this.buildWellKnownIssuerUrl(normalizedDomain);

    if (!logTrust) {
      return this.verifyIssuer({ issuerUrl });
    }

    if (this.apiKey) {
      const result = await this.requestJson('/api/issuers/verify', {
        method: 'POST',
        body: JSON.stringify({ domain: normalizedDomain, force })
      }, { requireApiKey: true });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Issuer Domain Verified (admin trust write)\n\n` +
              `Domain: ${normalizedDomain}\n` +
              `Status: ${result.status}\n` +
              `Message: ${result.message}\n` +
              `${this.formatTrustSummary(result)}\n\n` +
              `${JSON.stringify(result.issuer, null, 2)}`
          }
        ]
      };
    }

    if (force) {
      throw new Error('force=true requires API key (admin endpoint). Configure BADGE_API_KEY and retry.');
    }

    const result = await this.requestJson('/public/api/issuers/verify', {
      method: 'POST',
      body: JSON.stringify({ domain: normalizedDomain })
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Issuer Domain Verified (public trust write)\n\n` +
            `Domain: ${normalizedDomain}\n` +
            `Status: ${result.status}\n` +
            `Message: ${result.message}\n` +
            `${this.formatTrustSummary(result)}\n\n` +
            `${JSON.stringify(result.issuer, null, 2)}`
        }
      ]
    };
  }

  async generateIssuerProfileTemplate(args) {
    const { name, url, email, description, publicKeyMultibase } = GenerateIssuerTemplateSchema.parse(args || {});
    const normalizedUrl = url.replace(/\/+$/, '');

    let finalMultibase = publicKeyMultibase;
    let generatedPublicKeyPem = null;
    if (!finalMultibase) {
      const { publicKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      generatedPublicKeyPem = publicKey;
      const publicKeyDer = crypto.createPublicKey(publicKey).export({
        type: 'spki',
        format: 'der'
      });
      finalMultibase = `z${Buffer.from(publicKeyDer).toString('base64url')}`;
    }

    const profile = {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'
      ],
      id: `${normalizedUrl}/.well-known/openbadges-issuer.json`,
      type: 'Profile',
      name,
      url: normalizedUrl,
      ...(email ? { email } : {}),
      ...(description ? { description } : {}),
      publicKey: {
        id: `${normalizedUrl}/.well-known/openbadges-issuer.json#key`,
        type: 'Ed25519VerificationKey2020',
        controller: `${normalizedUrl}/.well-known/openbadges-issuer.json`,
        publicKeyMultibase: finalMultibase
      }
    };

    const fingerprint = this.computeKeyFingerprint(this.extractPublicKeyPem({
      publicKeyMultibase: finalMultibase
    }));

    return {
      content: [
        {
          type: 'text',
          text: `📄 Issuer Profile Template\n\n` +
            `Host this JSON at: ${normalizedUrl}/.well-known/openbadges-issuer.json\n` +
            `Domain: ${new URL(normalizedUrl).host}\n` +
            `Key Fingerprint: ${fingerprint || 'not available'}\n\n` +
            `${generatedPublicKeyPem ? `Generated Public Key PEM:\n${generatedPublicKeyPem}\n` : ''}` +
            `Profile JSON:\n${JSON.stringify(profile, null, 2)}`
        }
      ]
    };
  }

  async issueSampleBadge(args) {
    const payload = IssueSampleBadgeSchema.parse(args || {});
    const result = await this.requestJson('/public/api/demo/prompt-to-badge', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Sample badge issued\n\n` +
            `Badge URL: ${result.badgeUrl}\n` +
            `Verify URL: ${result.verifyUrl}\n` +
            `Trust Hint: ${result.trustHint}\n` +
            `Share Text: ${result.shareText}\n\n` +
            `${JSON.stringify(result.signedBadge, null, 2)}`
        }
      ]
    };
  }

  async explainVerificationResult(args) {
    const { verification } = ExplainVerificationResultSchema.parse(args || {});
    const trustState = verification.trustState || 'UNVERIFIED';
    const issuerDomain = verification.issuerDomain || verification.verification?.issuerDomain || 'unknown';
    const validationLabel = verification.validationLabel || verification.verification?.validationLabel ||
      (this.isDemoDomain(issuerDomain) ? 'DEMO' : null);
    const keyFingerprint = verification.keyFingerprint || verification.signature?.keyFingerprint || 'not available';
    const reason = verification.verificationReason || 'Issuer cannot be cryptographically verified.';
    const caveat = verification.trustCaveat || 'This verifies domain/key control. It does not certify assessment quality or accreditation.';

    const explanation = trustState === 'DOMAIN_VERIFIED_SIGNATURE'
      ? 'The badge is signed, the signature validates, and the signing key is discoverable for the issuer domain.'
      : 'The badge does not meet the conditions for domain-bound signature trust.';

    const nextSteps = trustState === 'DOMAIN_VERIFIED_SIGNATURE'
      ? 'Review criteria/evidence and issuer reputation for quality decisions.'
      : 'Check issuer URL reachability, key publication in .well-known profile, and proof signature validity.';

    return {
      content: [
        {
          type: 'text',
          text: `🧾 Verification Explanation\n\n` +
            `Trust State: ${trustState}\n` +
            `Issuer Domain: ${issuerDomain}\n` +
            `Validation Label: ${validationLabel || 'none'}\n` +
            `Key Fingerprint: ${keyFingerprint}\n` +
            `Reason: ${reason}\n\n` +
            `${explanation}\n\n` +
            `Caveat: ${caveat}\n` +
            `Next Step: ${nextSteps}`
        }
      ]
    };
  }

  async signBadge(args) {
    if (!this.apiKey) {
      throw new Error('API key not configured. Use test_server to check configuration or configure_server to set credentials.');
    }
    
    const { badgeData, domain } = args;
    
    const response = await fetch(`${this.baseUrl}/api/sign-badge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ badgeData, domain }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Badge Signing API Error: ${response.status} - ${errorData.error || errorData.message || response.statusText}`);
    }

    const result = await response.json();
    
    let detailsText = `\n\n🔐 Signing Details:\n`;
    detailsText += `• Domain: ${domain}\n`;
    detailsText += `• Verification Method: ${result.verificationMethod}\n`;
    detailsText += `• Signature: ${result.signature.substring(0, 50)}...\n`;
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Badge Signed Successfully!\n\nDomain: ${domain}${detailsText}\n\nSigned Badge:\n${JSON.stringify(result.signedBadge, null, 2)}`,
        },
      ],
    };
  }

  async cachePublicKey(args) {
    if (!this.apiKey) {
      throw new Error('API key not configured. Use test_server to check configuration or configure_server to set credentials.');
    }
    
    const { issuerUrl } = args;
    
    const response = await fetch(`${this.baseUrl}/api/cache-public-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ issuerUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Public Key Caching API Error: ${response.status} - ${errorData.error || errorData.message || response.statusText}`);
    }

    const result = await response.json();
    
    let detailsText = `\n\n🔑 Caching Details:\n`;
    detailsText += `• Issuer: ${result.issuerName}\n`;
    detailsText += `• Domain: ${result.domain}\n`;
    detailsText += `• Key Type: ${result.keyType}\n`;
    detailsText += `• Cached: ${result.cached ? 'Yes' : 'No'}\n`;
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Public Key Cached Successfully!\n\nIssuer URL: ${issuerUrl}${detailsText}\n\nThis issuer's badges can now be cryptographically verified!`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Badge Generator MCP server running on stdio');
  }
}

const server = new BadgeGeneratorMCPServer();
server.run().catch(console.error);
