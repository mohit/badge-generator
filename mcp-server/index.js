#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import { z } from 'zod';

// Configuration
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_API_KEY = process.env.BADGE_API_KEY || '';

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

const SmartBadgeSchema = z.object({
  title: z.string(),
  content: z.string(),
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
            name: 'create_smart_badge',
            description: 'Create a complete badge system (issuer, badge class, and assertion) from combined JSON objects',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Title/prefix for the badge files (e.g., "web-development")',
                },
                content: {
                  type: 'string',
                  description: 'Combined JSON objects for issuer, badge class, and assertion (separated by blank lines)',
                },
              },
              required: ['title', 'content'],
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
            name: 'configure_server',
            description: 'Configure the MCP server connection settings',
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
                  description: 'API key for authentication',
                },
              },
              required: ['baseUrl', 'apiKey'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'configure_server':
            return await this.configureServer(args);
          case 'create_issuer':
            return await this.createIssuer(args);
          case 'create_badge_class':
            return await this.createBadgeClass(args);
          case 'create_credential_subject':
            return await this.createCredentialSubject(args);
          case 'create_smart_badge':
            return await this.createSmartBadge(args);
          case 'list_badges':
            return await this.listBadges();
          case 'get_badge':
            return await this.getBadge(args);
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

  async configureServer(args) {
    const { baseUrl, apiKey } = args;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Server configured successfully!\nBase URL: ${baseUrl}\nAPI Key: ${apiKey ? '[SET]' : '[NOT SET]'}`,
        },
      ],
    };
  }

  async createIssuer(args) {
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
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Issuer created successfully!\n\nFilename: ${result.filename}\nURL: ${result.url}\n\nIssuer Details:\n${JSON.stringify(result.issuer, null, 2)}`,
        },
      ],
    };
  }

  async createBadgeClass(args) {
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

  async createSmartBadge(args) {
    const validatedData = SmartBadgeSchema.parse(args);
    
    // Note: This endpoint requires authentication but uses form data
    const formData = new URLSearchParams();
    formData.append('title', validatedData.title);
    formData.append('content', validatedData.content);
    
    const response = await fetch(`${this.baseUrl}/create-smart-badge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Note: Smart badge creation requires web session authentication
        // This would need to be handled differently in a real implementation
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}. Note: Smart badge creation requires web session authentication.`);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Smart Badge created successfully!\n\nTitle: ${validatedData.title}\nFiles created: ${validatedData.title}-issuer.json, ${validatedData.title}-badge.json, ${validatedData.title}-assertion.json`,
        },
      ],
    };
  }

  async listBadges() {
    const response = await fetch(`${this.baseUrl}/api/files`, {
      headers: {
        'X-API-Key': this.apiKey,
        // Note: This endpoint requires web session authentication in the current implementation
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}. Note: File listing requires web session authentication.`);
    }

    const files = await response.json();
    
    const fileList = files.map(file => `• ${file.name} - ${this.baseUrl}${file.url}`).join('\n');
    
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Badge Generator MCP server running on stdio');
  }
}

const server = new BadgeGeneratorMCPServer();
server.run().catch(console.error);