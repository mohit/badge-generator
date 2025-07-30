#!/usr/bin/env node

/**
 * Smart Badge Creator Test Suite
 * Tests various JSON input formats and edge cases
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Smart Badge Creator Test Suite\n');

// Test cases for various input formats
const testCases = [
  {
    name: 'Valid v2.0 Badge Set (Basic)',
    input: `{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://example.com/issuer/1",
  "name": "Test University",
  "url": "https://example.com"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "BadgeClass",
  "id": "https://example.com/badge/test",
  "name": "Test Badge",
  "description": "A test badge",
  "criteria": "Pass the test",
  "issuer": "https://example.com/issuer/1"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Assertion",
  "id": "https://example.com/assertion/123",
  "recipient": {
    "type": "email",
    "hashed": false,
    "identity": "test@example.com"
  },
  "badge": "https://example.com/badge/test",
  "issuedOn": "2024-01-15T10:00:00Z"
}`,
    expectedVersion: '2.0'
  },
  
  {
    name: 'Valid v3.0 Badge Set (Basic)',
    input: `{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://example.com/issuers/1",
  "type": "Profile",
  "name": "Test University",
  "url": "https://example.com"
}

{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://example.com/achievements/test",
  "type": "Achievement",
  "name": "Test Achievement",
  "description": "A test achievement",
  "achievementType": "Certificate"
}

{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://example.com/credentials/123",
  "type": ["VerifiableCredential", "OpenBadgeCredential"],
  "issuer": {
    "id": "https://example.com/issuers/1",
    "type": "Profile",
    "name": "Test University"
  },
  "validFrom": "2024-01-15T10:00:00Z",
  "credentialSubject": {
    "type": "AchievementSubject",
    "identifier": {
      "type": "IdentityObject",
      "hashed": false,
      "identityType": "email",
      "identity": "test@example.com"
    },
    "achievement": {
      "id": "https://example.com/achievements/test",
      "type": "Achievement"
    }
  }
}`,
    expectedVersion: '3.0'
  },

  {
    name: 'Mixed Spacing and Formatting',
    input: `    {
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://example.com/issuer/1",
  "name": "Spaced University"
    }


    {
      "@context": "https://w3id.org/openbadges/v2",
      "type": "BadgeClass",
      "id": "https://example.com/badge/spaced",
      "name": "Spaced Badge",
      "description": "Badge with weird spacing",
      "criteria": "Handle spacing",
      "issuer": "https://example.com/issuer/1"
    }



{
"@context": "https://w3id.org/openbadges/v2",
"type": "Assertion",
"id": "https://example.com/assertion/spaced",
"recipient": {"type": "email", "hashed": false, "identity": "spaced@example.com"},
"badge": "https://example.com/badge/spaced",
"issuedOn": "2024-01-15T10:00:00Z"
}`,
    expectedVersion: '2.0'
  },

  {
    name: 'Single Line JSON (Compact)',
    input: `{"@context": "https://w3id.org/openbadges/v2", "type": "Issuer", "id": "https://example.com/issuer/compact", "name": "Compact Issuer"}

{"@context": "https://w3id.org/openbadges/v2", "type": "BadgeClass", "id": "https://example.com/badge/compact", "name": "Compact Badge", "description": "Compact format", "criteria": "Be compact", "issuer": "https://example.com/issuer/compact"}

{"@context": "https://w3id.org/openbadges/v2", "type": "Assertion", "id": "https://example.com/assertion/compact", "recipient": {"type": "email", "hashed": false, "identity": "compact@example.com"}, "badge": "https://example.com/badge/compact", "issuedOn": "2024-01-15T10:00:00Z"}`,
    expectedVersion: '2.0'
  },

  {
    name: 'Invalid JSON - Missing Comma',
    input: `{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://example.com/issuer/1"
  "name": "Invalid Issuer"
}`,
    shouldFail: true,
    expectedError: 'JSON parsing'
  },

  {
    name: 'Invalid JSON - Trailing Comma',
    input: `{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://example.com/issuer/1",
  "name": "Invalid Issuer",
}`,
    shouldFail: true,
    expectedError: 'JSON parsing'
  },

  {
    name: 'Missing Required Objects',
    input: `{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://example.com/issuer/1",
  "name": "Lonely Issuer"
}`,
    shouldFail: true,
    expectedError: 'Missing required objects'
  },

  {
    name: 'Wrong Object Types',
    input: `{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "UnknownType",
  "id": "https://example.com/unknown/1",
  "name": "Unknown Object"
}`,
    shouldFail: true,
    expectedError: 'Missing required objects'
  }
];

// Test runner function
function runTests() {
  let passed = 0;
  let failed = 0;

  console.log(`Running ${testCases.length} test cases...\n`);

  testCases.forEach((testCase, index) => {
    console.log(`🧪 Test ${index + 1}: ${testCase.name}`);
    
    try {
      // Test JSON parsing
      const objects = testCase.input.trim().split('\n\n').map(obj => obj.trim()).filter(obj => obj);
      console.log(`   📄 Found ${objects.length} JSON objects`);
      
      // Parse each object
      const parsedObjects = [];
      objects.forEach((obj, objIndex) => {
        try {
          const parsed = JSON.parse(obj);
          parsedObjects.push(parsed);
          console.log(`   ✅ Object ${objIndex + 1}: ${parsed.type || 'Unknown type'}`);
        } catch (parseError) {
          if (testCase.shouldFail && testCase.expectedError === 'JSON parsing') {
            console.log(`   ✅ Expected JSON parsing error: ${parseError.message}`);
            throw new Error('Expected failure - JSON parsing');
          } else {
            console.log(`   ❌ JSON Parse Error in object ${objIndex + 1}:`);
            console.log(`      ${parseError.message}`);
            console.log(`      Object content (first 100 chars): ${obj.substring(0, 100)}...`);
            throw parseError;
          }
        }
      });

      // Test object type detection
      let issuer = null, badgeClass = null, assertion = null;
      let isV3 = false;

      parsedObjects.forEach(obj => {
        // v2.0 types
        if (obj.type === 'Issuer') issuer = obj;
        else if (obj.type === 'BadgeClass') badgeClass = obj;
        else if (obj.type === 'Assertion') assertion = obj;
        // v3.0 types
        else if (obj.type === 'Profile') { issuer = obj; isV3 = true; }
        else if (obj.type === 'Achievement') { badgeClass = obj; isV3 = true; }
        else if (Array.isArray(obj.type) && obj.type.includes('OpenBadgeCredential')) { assertion = obj; isV3 = true; }
      });

      // Check for required objects
      if (!issuer || !badgeClass || !assertion) {
        if (testCase.shouldFail && testCase.expectedError === 'Missing required objects') {
          console.log(`   ✅ Expected missing objects error`);
          throw new Error('Expected failure - Missing objects');
        } else {
          const missing = [];
          if (!issuer) missing.push('Issuer/Profile');
          if (!badgeClass) missing.push('BadgeClass/Achievement');  
          if (!assertion) missing.push('Assertion/OpenBadgeCredential');
          throw new Error(`Missing required objects: ${missing.join(', ')}`);
        }
      }

      // Verify version detection
      const detectedVersion = isV3 ? '3.0' : '2.0';
      console.log(`   🔍 Detected version: ${detectedVersion}`);
      
      if (testCase.expectedVersion && testCase.expectedVersion !== detectedVersion) {
        throw new Error(`Version mismatch: expected ${testCase.expectedVersion}, got ${detectedVersion}`);
      }

      // If we got here and it should have failed, that's a problem
      if (testCase.shouldFail) {
        console.log(`   ❌ Test should have failed but passed`);
        failed++;
      } else {
        console.log(`   ✅ Test passed successfully`);
        passed++;
      }

    } catch (error) {
      if (testCase.shouldFail) {
        console.log(`   ✅ Test failed as expected: ${error.message}`);
        passed++;
      } else {
        console.log(`   ❌ Test failed unexpectedly: ${error.message}`);
        failed++;
      }
    }
    
    console.log(''); // Empty line between tests
  });

  // Summary
  console.log('📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  return { passed, failed };
}

// Character position analyzer for debugging
function analyzeCharacterPosition(content, position) {
  console.log(`\n🔍 Analyzing character at position ${position}:`);
  
  const lines = content.split('\n');
  let currentPos = 0;
  let lineNumber = 1;
  
  for (const line of lines) {
    if (currentPos + line.length >= position) {
      const charInLine = position - currentPos;
      console.log(`   📍 Line ${lineNumber}, Character ${charInLine}`);
      console.log(`   📝 Line content: "${line}"`);
      console.log(`   👉 Character at position: "${content[position]}"`);
      console.log(`   🔤 Context: "${content.substring(Math.max(0, position - 20), position + 20)}"`);
      
      // Highlight the problematic character
      const before = line.substring(0, charInLine);
      const char = line[charInLine] || 'EOF';
      const after = line.substring(charInLine + 1);
      console.log(`   🎯 Highlighted: "${before}[${char}]${after}"`);
      break;
    }
    currentPos += line.length + 1; // +1 for newline
    lineNumber++;
  }
}

// Run the tests
const results = runTests();

// If there were failures, offer to analyze the position 218 error
if (results.failed > 0) {
  console.log('\n🚨 Some tests failed. Here are debugging tools:\n');
  
  // Create a sample input that might cause position 218 error
  const problematicInput = `{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://example.com/issuer/1",
  "name": "Test Issuer",
  "url": "https://example.com"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "BadgeClass",
  "id": "https://example.com/badge/test",
  "name": "Test Badge"
  "description": "Missing comma before this line"
}`;
  
  analyzeCharacterPosition(problematicInput, 218);
}

console.log('\n🎉 Test suite completed!');

if (results.failed === 0) {
  console.log('🏆 All tests passed! Smart Badge Creator should be working correctly.');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Check the output above for details.');
  process.exit(1);
}