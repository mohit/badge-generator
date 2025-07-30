#!/usr/bin/env node

/**
 * Integration Test for Smart Badge Creator
 * Tests the full end-to-end flow including API calls
 */

const http = require('http');
const querystring = require('querystring');

console.log('🔗 Smart Badge Creator Integration Test\n');

// Test configuration
const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;
const TEST_PASSWORD = 'cjaAsOEgPyvmoGvgQljyGihkuSsFlZ13eUygI0Ugn6M=';

// Test cases with various problematic inputs
const integrationTests = [
  {
    name: 'Valid v2.0 Badge (End-to-End)',
    title: 'integration-test-v2',
    content: `{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://test.com/issuer/integration",
  "name": "Integration Test University",
  "url": "https://test.com"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "BadgeClass",
  "id": "https://test.com/badge/integration",
  "name": "Integration Test Badge",
  "description": "Successfully completed integration testing",
  "criteria": "Pass all integration tests",
  "issuer": "https://test.com/issuer/integration"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Assertion",
  "id": "https://test.com/assertion/integration",
  "recipient": {
    "type": "email",
    "hashed": false,
    "identity": "integration@test.com"
  },
  "badge": "https://test.com/badge/integration",
  "issuedOn": "2024-01-15T10:00:00Z"
}`,
    shouldPass: true
  },

  {
    name: 'Malformed JSON - Position 218 Error Recreation',
    title: 'position-218-error',
    content: `{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://test.com/issuer/error",
  "name": "Error Test Issuer",
  "url": "https://test.com",
  "email": "test@error.com"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "BadgeClass",
  "id": "https://test.com/badge/error"
  "name": "Error Test Badge",
  "description": "This JSON has a missing comma that should trigger position error"
}`,
    shouldPass: false,
    expectedError: 'JSON parsing error'
  },

  {
    name: 'Empty Content',
    title: 'empty-test',
    content: '',
    shouldPass: false,
    expectedError: 'No JSON objects found'
  },

  {
    name: 'Only Whitespace',
    title: 'whitespace-test', 
    content: '   \n\n   \t   \n  ',
    shouldPass: false,
    expectedError: 'No JSON objects found'
  }
];

// Helper function to make HTTP requests
function makeRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers
      }
    };

    if (data) {
      const postData = querystring.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);

    if (data) {
      const postData = querystring.stringify(data);
      req.write(postData);
    }
    
    req.end();
  });
}

// Check if server is running
async function checkServer() {
  try {
    console.log('🔍 Checking server status...');
    const response = await makeRequest('GET', '/');
    if (response.statusCode === 302 || response.statusCode === 200) {
      console.log('✅ Server is running\n');
      return true;
    } else {
      console.log(`❌ Server returned status ${response.statusCode}\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Server is not running: ${error.message}`);
    console.log('💡 Please start the server with: node server.js\n');
    return false;
  }
}

// Get session cookie by logging in
async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await makeRequest('POST', '/login', {
      password: TEST_PASSWORD
    });
    
    if (response.statusCode === 302 && response.headers['set-cookie']) {
      const cookies = response.headers['set-cookie'];
      const sessionCookie = cookies.find(cookie => cookie.startsWith('connect.sid'));
      if (sessionCookie) {
        console.log('✅ Login successful\n');
        return sessionCookie.split(';')[0]; // Extract just the cookie value
      }
    }
    
    console.log(`❌ Login failed: ${response.statusCode}`);
    console.log(`Response: ${response.body.substring(0, 200)}...\n`);
    return null;
  } catch (error) {
    console.log(`❌ Login error: ${error.message}\n`);
    return null;
  }
}

// Test smart badge creation
async function testSmartBadgeCreation(sessionCookie, testCase) {
  try {
    console.log(`🧪 Testing: ${testCase.name}`);
    console.log(`   Title: ${testCase.title}`);
    console.log(`   Content length: ${testCase.content.length} characters`);
    
    const response = await makeRequest('POST', '/create-smart-badge', {
      title: testCase.title,
      content: testCase.content
    }, {
      'Cookie': sessionCookie
    });
    
    console.log(`   Response status: ${response.statusCode}`);
    
    if (testCase.shouldPass) {
      if (response.statusCode === 302) {
        console.log('   ✅ Test PASSED - Badge created successfully');
        return { success: true };
      } else {
        console.log(`   ❌ Test FAILED - Expected success but got ${response.statusCode}`);
        console.log(`   Response: ${response.body.substring(0, 300)}...`);
        return { success: false, error: `Unexpected status ${response.statusCode}` };
      }
    } else {
      if (response.statusCode === 400) {
        const errorMatch = response.body.includes(testCase.expectedError || 'error');
        if (errorMatch) {
          console.log('   ✅ Test PASSED - Failed as expected with correct error');
          return { success: true };
        } else {
          console.log(`   ❌ Test FAILED - Wrong error type`);
          console.log(`   Expected: ${testCase.expectedError}`);
          console.log(`   Got: ${response.body.substring(0, 200)}...`);
          return { success: false, error: 'Wrong error type' };
        }
      } else {
        console.log(`   ❌ Test FAILED - Expected error but got ${response.statusCode}`);
        return { success: false, error: `Expected failure but got ${response.statusCode}` };
      }
    }
  } catch (error) {
    console.log(`   ❌ Test ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runIntegrationTests() {
  console.log('🚀 Starting Integration Tests...\n');
  
  // Check server
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Cannot run tests - server is not available');
    process.exit(1);
  }
  
  // Login
  const sessionCookie = await login();
  if (!sessionCookie) {
    console.log('❌ Cannot run tests - login failed');
    process.exit(1);
  }
  
  // Run tests
  let passed = 0;
  let failed = 0;
  
  for (const testCase of integrationTests) {
    const result = await testSmartBadgeCreation(sessionCookie, testCase);
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
    console.log(''); // Empty line between tests
  }
  
  // Summary
  console.log('📊 Integration Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All integration tests passed!');
    console.log('🏆 Smart Badge Creator is working correctly end-to-end.');
  } else {
    console.log('\n⚠️  Some integration tests failed.');
    console.log('🔧 Check the server logs and error messages above.');
  }
  
  return { passed, failed };
}

// Usage instructions if run directly
if (require.main === module) {
  console.log('🧪 Smart Badge Creator Integration Test Suite');
  console.log('============================================\n');
  console.log('Prerequisites:');
  console.log('1. Badge Generator server must be running on localhost:3000');
  console.log('2. Server must have correct credentials configured');
  console.log('3. Start server with: node server.js\n');
  
  runIntegrationTests().catch(error => {
    console.log(`💥 Test suite crashed: ${error.message}`);
    process.exit(1);
  });
}