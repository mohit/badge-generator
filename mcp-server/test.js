#!/usr/bin/env node

import fetch from 'node-fetch';
import { config } from 'dotenv';

// Load test environment variables
config({ path: 'mcp-server/.env.test' });

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.TEST_API_KEY || ''
};

class MCPServerTester {
  constructor() {
    this.baseUrl = TEST_CONFIG.baseUrl;
    this.apiKey = TEST_CONFIG.apiKey;
    this.testResults = [];
    
    if (!this.apiKey) {
      console.error('❌ No TEST_API_KEY found in environment variables.');
      console.error('Please create .env.test file with:');
      console.error('TEST_BASE_URL=your_server_url');
      console.error('TEST_API_KEY=your_api_key');
      process.exit(1);
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
    this.testResults.push({ timestamp, type, message });
  }

  async testEndpoint(name, testFn) {
    this.log(`Testing ${name}...`);
    try {
      await testFn();
      this.log(`${name} - PASSED`, 'success');
    } catch (error) {
      this.log(`${name} - FAILED: ${error.message}`, 'error');
    }
  }

  async testBasicConnectivity() {
    const response = await fetch(`${this.baseUrl}/`);
    if (!response.ok) {
      throw new Error(`Server not reachable: ${response.status}`);
    }
  }

  async testListBadgesEndpoint() {
    // Test the /api/badge-files endpoint that list_badges uses
    const response = await fetch(`${this.baseUrl}/api/badge-files`, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText}\nResponse: ${errorText}`);
    }

    const files = await response.json();
    this.log(`Found ${files.length} badge files`);
    
    // Validate response structure
    if (!Array.isArray(files)) {
      throw new Error('Response is not an array');
    }

    files.forEach((file, index) => {
      if (!file.name || !file.url) {
        throw new Error(`File ${index} missing required properties (name, url)`);
      }
    });
  }

  async testPublicBadgeAccess() {
    // First get list of files
    const response = await fetch(`${this.baseUrl}/api/badge-files`, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Cannot get file list for public access test');
    }

    const files = await response.json();
    if (files.length === 0) {
      this.log('No badge files to test public access', 'info');
      return;
    }

    // Test accessing the first badge file publicly
    const firstFile = files[0];
    const badgeResponse = await fetch(`${this.baseUrl}${firstFile.url}`);
    
    if (!badgeResponse.ok) {
      throw new Error(`Cannot access badge file publicly: ${badgeResponse.status}`);
    }

    const badgeData = await badgeResponse.json();
    this.log(`Successfully accessed badge: ${firstFile.name}`);
    
    // Basic validation of badge structure
    if (!badgeData.type && !badgeData['@context']) {
      throw new Error('Badge file does not appear to be valid Open Badges format');
    }
  }

  async testCreateIssuer() {
    const testIssuer = {
      id: `${this.baseUrl}/test-issuer-${Date.now()}`,
      name: 'MCP Test Organization',
      url: 'https://example.com',
      email: 'test@example.com',
      description: 'Test issuer created by MCP server tests'
    };

    const response = await fetch(`${this.baseUrl}/api/issuer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(testIssuer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText}\nResponse: ${errorText}`);
    }

    const result = await response.json();
    this.log(`Created test issuer: ${result.filename}`);
    
    // Validate response structure
    if (!result.filename || !result.url || !result.issuer) {
      throw new Error('Invalid create issuer response structure');
    }

    return result;
  }

  async testCreateBadgeClass(issuerUrl) {
    const testBadgeClass = {
      id: `${this.baseUrl}/test-badge-${Date.now()}`,
      name: 'MCP Test Badge',
      description: 'Test badge created by MCP server tests',
      criteria: 'Successfully run MCP server tests',
      issuer: issuerUrl,
      tags: ['test', 'mcp']
    };

    const response = await fetch(`${this.baseUrl}/api/badge-class`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(testBadgeClass),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText}\nResponse: ${errorText}`);
    }

    const result = await response.json();
    this.log(`Created test badge class: ${result.filename}`);
    
    return result;
  }

  async testCreateCredentialSubject(badgeUrl) {
    const testCredential = {
      id: `${this.baseUrl}/test-credential-${Date.now()}`,
      recipient: {
        type: 'email',
        hashed: false,
        identity: 'test@example.com'
      },
      badge: badgeUrl,
      issuedOn: new Date().toISOString()
    };

    const response = await fetch(`${this.baseUrl}/api/credential-subject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(testCredential),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText}\nResponse: ${errorText}`);
    }

    const result = await response.json();
    this.log(`Created test credential: ${result.filename}`);
    
    return result;
  }

  async runAllTests() {
    this.log('Starting MCP Server Tests', 'info');
    this.log(`Testing against: ${this.baseUrl}`, 'info');
    
    await this.testEndpoint('Basic Connectivity', () => this.testBasicConnectivity());
    await this.testEndpoint('List Badges Endpoint', () => this.testListBadgesEndpoint());
    await this.testEndpoint('Public Badge Access', () => this.testPublicBadgeAccess());
    
    // Test the full workflow
    let issuerResult, badgeResult;
    await this.testEndpoint('Create Issuer', async () => {
      issuerResult = await this.testCreateIssuer();
    });
    
    if (issuerResult) {
      await this.testEndpoint('Create Badge Class', async () => {
        badgeResult = await this.testCreateBadgeClass(issuerResult.issuer.id);
      });
    }
    
    if (badgeResult) {
      await this.testEndpoint('Create Credential Subject', async () => {
        await this.testCreateCredentialSubject(badgeResult.badgeClass.id);
      });
    }

    // Final test - list badges again to see our created files
    await this.testEndpoint('List Badges After Creation', () => this.testListBadgesEndpoint());

    this.printSummary();
  }

  printSummary() {
    const total = this.testResults.filter(r => r.message.includes('PASSED') || r.message.includes('FAILED')).length;
    const passed = this.testResults.filter(r => r.message.includes('PASSED')).length;
    const failed = this.testResults.filter(r => r.message.includes('FAILED')).length;

    console.log('\n' + '='.repeat(50));
    console.log('TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${total > 0 ? Math.round((passed / total) * 100) : 0}%`);
    
    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.testResults
        .filter(r => r.type === 'error')
        .forEach(r => console.log(`  - ${r.message}`));
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MCPServerTester();
  tester.runAllTests().catch(console.error);
}

export default MCPServerTester;