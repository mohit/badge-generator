#!/usr/bin/env node

/**
 * Server-side Smart Badge Creator Test
 * Tests the exact logic used in the server endpoint
 */

const path = require('path');

console.log('🔧 Server-side Smart Badge Creator Test\n');

// Simulate the exact server-side processing logic
function processSmartBadge(title, content) {
  console.log(`Processing badge with title: "${title}"`);
  console.log(`Content length: ${content.length} characters`);
  console.log(`Content preview: ${content.substring(0, 100)}...\n`);

  try {
    // Parse multiple JSON objects (exact server logic)
    const objects = content.trim().split('\n\n').map(obj => obj.trim()).filter(obj => obj);
    console.log(`📄 Split into ${objects.length} objects`);
    
    objects.forEach((obj, index) => {
      console.log(`Object ${index + 1} preview: ${obj.substring(0, 60)}...`);
    });
    
    const parsedObjects = objects.map((obj, index) => {
      try {
        console.log(`\n🔍 Parsing object ${index + 1}:`);
        const parsed = JSON.parse(obj);
        console.log(`✅ Object ${index + 1} parsed successfully: ${parsed.type || 'Unknown'}`);
        return parsed;
      } catch (error) {
        console.log(`❌ Error parsing object ${index + 1}:`);
        console.log(`   Error: ${error.message}`);
        console.log(`   Object content: ${obj}`);
        
        // Analyze character position if available
        if (error.message.includes('position')) {
          const match = error.message.match(/position (\d+)/);
          if (match) {
            const pos = parseInt(match[1]);
            console.log(`   Character at position ${pos}: "${obj[pos] || 'EOF'}"`);
            console.log(`   Context: "${obj.substring(Math.max(0, pos - 10), pos + 10)}"`);
          }
        }
        throw error;
      }
    });
    
    // Identify object types (exact server logic)
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
    
    console.log(`\n🔍 Object detection results:`);
    console.log(`   Issuer/Profile: ${issuer ? '✅' : '❌'}`);
    console.log(`   BadgeClass/Achievement: ${badgeClass ? '✅' : '❌'}`);
    console.log(`   Assertion/Credential: ${assertion ? '✅' : '❌'}`);
    console.log(`   Detected version: ${isV3 ? 'v3.0' : 'v2.0'}`);
    
    if (!issuer || !badgeClass || !assertion) {
      throw new Error('Missing required objects. Please include Issuer/Profile, BadgeClass/Achievement, and Assertion/OpenBadgeCredential.');
    }
    
    // Generate URLs (simplified)
    const baseUrl = 'http://localhost:3000/badges';
    const issuerUrl = `${baseUrl}/${title}-${isV3 ? 'profile' : 'issuer'}.json`;
    const badgeUrl = `${baseUrl}/${title}-${isV3 ? 'achievement' : 'badge'}.json`;
    const assertionUrl = `${baseUrl}/${title}-${isV3 ? 'credential' : 'assertion'}.json`;
    
    console.log(`\n🔗 Generated URLs:`);
    console.log(`   Issuer: ${issuerUrl}`);
    console.log(`   Badge: ${badgeUrl}`);
    console.log(`   Assertion: ${assertionUrl}`);
    
    console.log(`\n✅ Processing completed successfully!`);
    return { success: true, isV3, issuer, badgeClass, assertion };
    
  } catch (error) {
    console.log(`\n❌ Processing failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test cases that might cause position 218 error
const testCases = [
  {
    name: 'Load Example v2.0 (from server)',
    title: 'example-v2',
    content: `{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://example.com/issuer/1",
  "name": "Example University",
  "url": "https://example.com",
  "email": "badges@example.com"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "BadgeClass",
  "id": "https://example.com/badge/web-development",
  "name": "Web Development Certificate",
  "description": "Demonstrates proficiency in modern web development",
  "image": "https://example.com/badge-image.png",
  "criteria": "https://example.com/criteria/web-dev",
  "issuer": "https://example.com/issuer/1"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Assertion",
  "id": "https://example.com/assertion/123",
  "recipient": {
    "type": "email",
    "hashed": false,
    "identity": "student@example.com"
  },
  "badge": "https://example.com/badge/web-development",
  "issuedOn": "2024-01-15T10:00:00Z"
}`
  },
  
  {
    name: 'Load Example v3.0 (from server)',
    title: 'example-v3',
    content: `{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://example.com/issuers/1",
  "type": "Profile",
  "name": "Example University",
  "url": "https://example.com",
  "email": "badges@example.com"
}

{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://example.com/achievements/web-development",
  "type": "Achievement",
  "name": "Web Development Certificate",
  "description": "Demonstrates proficiency in modern web development",
  "achievementType": "Certificate",
  "criteria": {
    "narrative": "Complete web development course with 80% score"
  }
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
    "name": "Example University"
  },
  "validFrom": "2024-01-15T10:00:00Z",
  "name": "Web Development Certificate",
  "credentialSubject": {
    "type": "AchievementSubject",
    "identifier": {
      "type": "IdentityObject",
      "hashed": false,
      "identityType": "email",
      "identity": "student@example.com"
    },
    "achievement": {
      "id": "https://example.com/achievements/web-development",
      "type": "Achievement",
      "name": "Web Development Certificate"
    }
  }
}`
  },

  {
    name: 'Potential Position 218 Error Case',
    title: 'position-218-test',
    content: `{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://example.com/issuer/1",
  "name": "Test Issuer",
  "url": "https://example.com"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "BadgeClass"
  "id": "https://example.com/badge/test"
}`
  }
];

// Run tests
testCases.forEach((testCase, index) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Test ${index + 1}: ${testCase.name}`);
  console.log(`${'='.repeat(60)}`);
  
  const result = processSmartBadge(testCase.title, testCase.content);
  
  if (result.success) {
    console.log(`🎉 Test ${index + 1} PASSED`);
  } else {
    console.log(`💥 Test ${index + 1} FAILED: ${result.error}`);
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log('📊 Server-side testing completed!');
console.log(`${'='.repeat(60)}`);