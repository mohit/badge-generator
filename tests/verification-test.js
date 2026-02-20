#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

config({ path: 'mcp-server/.env.test' });
config();

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.TEST_API_KEY || process.env.API_KEY;

if (!API_KEY) {
  console.error('❌ Missing API key. Set TEST_API_KEY in mcp-server/.env.test (preferred) or API_KEY in your environment.');
  process.exit(1);
}

class VerificationTester {
  constructor() {
    this.testResults = [];
    this.testBadges = [];
  }

  async runTest(name, testFunction) {
    console.log(`\n🧪 Running test: ${name}`);
    try {
      const result = await testFunction();
      this.testResults.push({ name, status: 'PASS', result });
      console.log(`✅ ${name}: PASSED`);
      return result;
    } catch (error) {
      this.testResults.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ ${name}: FAILED - ${error.message}`);
      throw error;
    }
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const requestOptions = {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`API Error: ${response.status} - ${errorData.error || errorData.message}`);
    }

    return await response.json();
  }

  async createTestBadge() {
    console.log('📋 Creating test badge for verification...');
    
    // Create issuer
    const issuerData = {
      id: `${BASE_URL}/badges/test-verification-issuer.json`,
      name: 'Test Verification Academy',
      url: 'https://demo.example.org',
      email: 'test@demo.example.org',
      description: 'Test issuer for verification testing'
    };

    const issuerResult = await this.makeRequest('/api/issuer', {
      method: 'POST',
      body: JSON.stringify(issuerData)
    });

    // Create badge class
    const badgeClassData = {
      id: `${BASE_URL}/badges/test-verification-badge.json`,
      name: 'Verification Test Badge',
      description: 'Badge for testing verification functionality',
      criteria: 'Successfully complete verification testing',
      issuer: issuerData.id,
      tags: ['test', 'verification']
    };

    const badgeClassResult = await this.makeRequest('/api/badge-class', {
      method: 'POST',
      body: JSON.stringify(badgeClassData)
    });

    // Create credential
    const credentialData = {
      id: `${BASE_URL}/badges/test-verification-credential.json`,
      recipient: {
        type: 'email',
        hashed: false,
        identity: 'testuser@test.example.com'
      },
      badge: badgeClassData.id,
      issuedOn: new Date().toISOString(),
      evidence: 'https://test.example.com/evidence/123'
    };

    const credentialResult = await this.makeRequest('/api/credential-subject', {
      method: 'POST',
      body: JSON.stringify(credentialData)
    });

    this.testBadges = {
      issuer: issuerResult,
      badgeClass: badgeClassResult,
      credential: credentialResult
    };

    console.log('✅ Test badges created successfully');
    return this.testBadges;
  }

  async testBadgeVerification() {
    const badgeUrl = this.testBadges.credential.url;
    
    const result = await this.makeRequest(`/api/verify/badge/${encodeURIComponent(badgeUrl)}`);
    
    // Validate response structure
    if (!result.hasOwnProperty('valid')) {
      throw new Error('Response missing "valid" field');
    }
    
    if (!result.verificationLevel) {
      throw new Error('Response missing "verificationLevel" field');
    }
    
    if (!result.structure || !result.issuer) {
      throw new Error('Response missing structure or issuer verification');
    }
    
    if (!result.valid) {
      throw new Error(`Badge verification failed: ${JSON.stringify(result, null, 2)}`);
    }
    
    console.log(`   ✅ Badge is valid with level: ${result.verificationLevel}`);
    return result;
  }

  async testIssuerVerification() {
    const issuerUrl = this.testBadges.issuer.url;
    
    const result = await this.makeRequest(`/api/verify/issuer/${encodeURIComponent(issuerUrl)}`);
    
    // Validate response structure
    if (!result.hasOwnProperty('valid')) {
      throw new Error('Response missing "valid" field');
    }
    
    if (!result.verification) {
      throw new Error('Response missing "verification" field');
    }
    
    if (!result.valid) {
      throw new Error(`Issuer verification failed: ${JSON.stringify(result, null, 2)}`);
    }
    
    console.log(`   ✅ Issuer is valid: ${result.verification.message}`);
    return result;
  }

  async testInvalidBadgeVerification() {
    const invalidBadgeUrl = 'https://invalid.example.com/nonexistent-badge.json';
    
    try {
      await this.makeRequest(`/api/verify/badge/${encodeURIComponent(invalidBadgeUrl)}`);
      throw new Error('Expected verification to fail for invalid badge URL');
    } catch (error) {
      if (error.message.includes('Expected verification to fail')) {
        throw error;
      }
      // This is expected - the API should return an error for invalid badges
      console.log(`   ✅ Correctly rejected invalid badge URL`);
      return true;
    }
  }

  async testMalformedBadgeVerification() {
    // Create a test file with malformed JSON
    const malformedBadgeContent = '{"invalid": "json", "missing": "fields"}';
    const malformedFileName = 'malformed-test-badge.json';
    
    // Write malformed badge to uploads directory
    fs.writeFileSync(path.join('uploads', malformedFileName), malformedBadgeContent);
    
    const malformedBadgeUrl = `${BASE_URL}/badges/${malformedFileName}`;
    
    const result = await this.makeRequest(`/api/verify/badge/${encodeURIComponent(malformedBadgeUrl)}`);
    
    // Should be invalid due to missing required fields
    if (result.valid) {
      throw new Error('Expected malformed badge to be invalid');
    }
    
    if (!result.structure || result.structure.valid) {
      throw new Error('Expected structure validation to fail for malformed badge');
    }
    
    console.log(`   ✅ Correctly identified malformed badge as invalid`);
    console.log(`   📋 Errors: ${result.structure.errors.join(', ')}`);
    
    // Clean up
    fs.unlinkSync(path.join('uploads', malformedFileName));
    
    return result;
  }

  async testCryptographicSigning() {
    // Test requires issuer verification files to exist
    const keyPath = 'issuer-verification-files/private-key.pem';
    if (!fs.existsSync(keyPath)) {
      console.log('   ⚠️ Skipping cryptographic signing test - no private key found');
      console.log('   💡 Run: badge-cli generate-keys to create verification files');
      return { skipped: true };
    }
    
    const badgeData = {
      "@context": "https://w3id.org/openbadges/v2",
      "type": "Assertion",
      "id": `${BASE_URL}/badges/test-signed-badge.json`,
      "recipient": {
        "type": "email",
        "hashed": false,
        "identity": "signtest@test.example.com"
      },
      "badge": this.testBadges.badgeClass.url,
      "issuedOn": new Date().toISOString()
    };
    
    const domain = 'demo.example.org';
    
    const result = await this.makeRequest('/api/sign-badge', {
      method: 'POST',
      body: JSON.stringify({ badgeData, domain })
    });
    
    if (!result.signedBadge || !result.signedBadge.proof) {
      throw new Error('Signed badge missing proof/signature');
    }
    
    if (!result.signature) {
      throw new Error('Response missing signature field');
    }
    
    console.log(`   ✅ Badge signed successfully`);
    console.log(`   🔐 Signature type: ${result.signedBadge.proof.type}`);
    
    return result;
  }

  async testSignedBadgeVerification() {
    // This test depends on the previous signing test
    const keyPath = 'issuer-verification-files/private-key.pem';
    if (!fs.existsSync(keyPath)) {
      console.log('   ⚠️ Skipping signed badge verification test - no private key found');
      return { skipped: true };
    }
    
    // First create and sign a badge
    const signingResult = await this.testCryptographicSigning();
    if (signingResult.skipped) {
      return { skipped: true };
    }
    
    // Save the signed badge
    const signedFileName = 'test-signed-verification.json';
    fs.writeFileSync(
      path.join('uploads', signedFileName), 
      JSON.stringify(signingResult.signedBadge, null, 2)
    );
    
    const signedBadgeUrl = `${BASE_URL}/badges/${signedFileName}`;
    
    // Now verify the signed badge
    const result = await this.makeRequest(`/api/verify/badge/${encodeURIComponent(signedBadgeUrl)}`);
    
    if (!result.valid) {
      throw new Error('Signed badge verification failed');
    }
    
    if (result.verificationLevel !== 'cryptographically_verified') {
      throw new Error(`Expected cryptographically_verified level, got: ${result.verificationLevel}`);
    }
    
    if (!result.signature || !result.signature.valid) {
      throw new Error('Signature verification failed');
    }
    
    console.log(`   ✅ Signed badge verified successfully`);
    console.log(`   🔐 Verification level: ${result.verificationLevel}`);
    
    // Clean up
    fs.unlinkSync(path.join('uploads', signedFileName));
    
    return result;
  }

  async runAllTests() {
    console.log('🚀 Starting Badge Verification Tests');
    console.log(`📡 Testing against: ${BASE_URL}`);

    try {
      // Setup
      await this.runTest('Create Test Badge System', () => this.createTestBadge());
      
      // Basic verification tests
      await this.runTest('Badge Verification', () => this.testBadgeVerification());
      await this.runTest('Issuer Verification', () => this.testIssuerVerification());
      
      // Error handling tests
      await this.runTest('Invalid Badge Rejection', () => this.testInvalidBadgeVerification());
      await this.runTest('Malformed Badge Detection', () => this.testMalformedBadgeVerification());
      
      // Cryptographic tests
      await this.runTest('Cryptographic Signing', () => this.testCryptographicSigning());
      await this.runTest('Signed Badge Verification', () => this.testSignedBadgeVerification());
      
    } catch (error) {
      console.log(`\n❌ Test suite failed: ${error.message}`);
    }

    // Summary
    console.log('\n📊 Test Results Summary:');
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const skipped = this.testResults.filter(r => r.result?.skipped).length;
    
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⚠️ Skipped: ${skipped}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => r.status === 'FAIL').forEach(test => {
        console.log(`   • ${test.name}: ${test.error}`);
      });
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
      
      if (skipped > 0) {
        console.log('\n💡 Some tests were skipped. To run all tests:');
        console.log('   1. Run: badge-cli generate-keys --name "Test Academy" --url "https://demo.example.org" --email "test@demo.example.org"');
        console.log('   2. Re-run the verification tests');
      }
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new VerificationTester();
  tester.runAllTests().catch(console.error);
}

export default VerificationTester;
