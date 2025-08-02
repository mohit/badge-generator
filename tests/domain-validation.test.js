#!/usr/bin/env node

import fetch from 'node-fetch';
import { config } from 'dotenv';

// Load test environment variables
config({ path: 'mcp-server/.env.test' });

const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.TEST_API_KEY || ''
};

class DomainValidationTester {
  constructor() {
    this.baseUrl = TEST_CONFIG.baseUrl;
    this.apiKey = TEST_CONFIG.apiKey;
    this.testResults = [];
    
    if (!this.apiKey) {
      console.error('❌ No TEST_API_KEY found in environment variables.');
      console.error('Please create mcp-server/.env.test file with credentials');
      process.exit(1);
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
    this.testResults.push({ timestamp, type, message });
  }

  async testDomainValidation(url, expectedType, expectedValid, description) {
    this.log(`Testing: ${description}`);
    try {
      const response = await fetch(`${this.baseUrl}/api/validate-issuer-domain?url=${encodeURIComponent(url)}`, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Validate response structure
      if (typeof result.valid !== 'boolean') {
        throw new Error('Response missing valid field');
      }
      
      if (!result.type) {
        throw new Error('Response missing type field');
      }
      
      if (!result.message) {
        throw new Error('Response missing message field');
      }

      // Check expected values
      if (result.valid !== expectedValid) {
        throw new Error(`Expected valid=${expectedValid}, got ${result.valid}`);
      }
      
      if (result.type !== expectedType) {
        throw new Error(`Expected type=${expectedType}, got ${result.type}`);
      }

      this.log(`✓ ${url} → ${result.type} (${result.valid ? 'valid' : 'invalid'})`, 'success');
      return result;
    } catch (error) {
      this.log(`✗ ${description}: ${error.message}`, 'error');
      throw error;
    }
  }

  async testIssuerCreation(url, shouldSucceed, description) {
    this.log(`Testing issuer creation: ${description}`);
    try {
      const testIssuer = {
        id: url,
        name: 'Test Organization',
        url: url.replace(/\/issuer.*/, ''),
        email: 'test@test.example.com'
      };

      const response = await fetch(`${this.baseUrl}/api/issuer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(testIssuer),
      });

      const result = await response.json();

      if (shouldSucceed) {
        if (!response.ok) {
          throw new Error(`Expected success but got ${response.status}: ${result.error || result.message}`);
        }
        
        // Validate successful response structure
        if (!result.filename || !result.url || !result.issuer) {
          throw new Error('Missing required fields in success response');
        }
        
        this.log(`✓ Issuer created: ${result.filename}`, 'success');
        return result;
      } else {
        if (response.ok) {
          throw new Error(`Expected failure but issuer was created: ${result.filename}`);
        }
        
        // Validate error response structure
        if (!result.error && !result.message) {
          throw new Error('Missing error message in failure response');
        }
        
        this.log(`✓ Correctly blocked: ${result.error}`, 'success');
        return result;
      }
    } catch (error) {
      this.log(`✗ ${description}: ${error.message}`, 'error');
      throw error;
    }
  }

  async testEndpoint(name, testFn) {
    try {
      await testFn();
      this.log(`${name} - PASSED`, 'success');
      return true;
    } catch (error) {
      this.log(`${name} - FAILED: ${error.message}`, 'error');
      return false;
    }
  }

  async runDomainValidationTests() {
    this.log('Starting Domain Validation Tests', 'info');
    
    const tests = [
      // Verified domain tests
      {
        name: 'Verified Domain - Our Platform',
        testFn: () => this.testDomainValidation(
          'https://badge-generator-production.up.railway.app/issuer/1',
          'verified',
          true,
          'our verified issuer domain'
        )
      },
      
      // Safe testing domain tests
      {
        name: 'Safe Testing - example.com',
        testFn: () => this.testDomainValidation(
          'https://example.com/issuer/1',
          'testing',
          true,
          'example.com domain'
        )
      },
      {
        name: 'Safe Testing - demo.example.org',
        testFn: () => this.testDomainValidation(
          'https://demo.example.org/issuer/1',
          'testing',
          true,
          'demo.example.org subdomain'
        )
      },
      {
        name: 'Safe Testing - test.example.com',
        testFn: () => this.testDomainValidation(
          'https://test.example.com/issuer/1',
          'testing',
          true,
          'test.example.com subdomain'
        )
      },
      
      // Blocked domain tests
      {
        name: 'Blocked Domain - Harvard',
        testFn: () => this.testDomainValidation(
          'https://harvard.edu/issuer/1',
          'blocked',
          false,
          'harvard.edu (should be blocked)'
        )
      },
      {
        name: 'Blocked Domain - Microsoft',
        testFn: () => this.testDomainValidation(
          'https://microsoft.com/issuer/1',
          'blocked',
          false,
          'microsoft.com (should be blocked)'
        )
      },
      {
        name: 'Blocked Domain - Google',
        testFn: () => this.testDomainValidation(
          'https://google.com/issuer/1',
          'blocked',
          false,
          'google.com (should be blocked)'
        )
      },
      
      // Localhost/development domains
      {
        name: 'Localhost Domain',
        testFn: () => this.testDomainValidation(
          'http://localhost:3000/issuer/1',
          'testing',
          true,
          'localhost domain'
        )
      },
      
      // Invalid URL tests
      {
        name: 'Invalid URL Format',
        testFn: () => this.testDomainValidation(
          'not-a-url',
          'invalid',
          false,
          'invalid URL format'
        )
      }
    ];

    const results = [];
    for (const test of tests) {
      const passed = await this.testEndpoint(test.name, test.testFn);
      results.push(passed);
    }

    return results;
  }

  async runIssuerCreationTests() {
    this.log('Starting Issuer Creation Tests', 'info');
    
    const tests = [
      // Should succeed
      {
        name: 'Create Issuer - Safe Domain',
        testFn: () => this.testIssuerCreation(
          'https://demo.example.org/issuer/test-' + Date.now(),
          true,
          'with safe testing domain'
        )
      },
      
      // Should fail
      {
        name: 'Block Issuer - Real Domain',
        testFn: () => this.testIssuerCreation(
          'https://stanford.edu/issuer/test-' + Date.now(),
          false,
          'with blocked real domain'
        )
      }
    ];

    const results = [];
    for (const test of tests) {
      const passed = await this.testEndpoint(test.name, test.testFn);
      results.push(passed);
    }

    return results;
  }

  async runAllTests() {
    this.log('🧪 Domain Validation Test Suite', 'info');
    this.log(`Testing against: ${this.baseUrl}`, 'info');
    
    const domainResults = await this.runDomainValidationTests();
    const issuerResults = await this.runIssuerCreationTests();
    
    const allResults = [...domainResults, ...issuerResults];
    this.printSummary(allResults);
    
    return allResults;
  }

  printSummary(results) {
    const total = results.length;
    const passed = results.filter(r => r).length;
    const failed = total - passed;

    console.log('\n' + '='.repeat(60));
    console.log('DOMAIN VALIDATION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${total > 0 ? Math.round((passed / total) * 100) : 0}%`);
    
    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.testResults
        .filter(r => r.type === 'error' && r.message.includes('FAILED'))
        .forEach(r => console.log(`  - ${r.message}`));
    } else {
      console.log('\n🎉 All domain validation tests passed!');
    }
    
    return failed === 0;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new DomainValidationTester();
  tester.runAllTests()
    .then(results => {
      const allPassed = results.every(r => r);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

export default DomainValidationTester;