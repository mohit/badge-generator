#!/usr/bin/env node

/**
 * Master Test Runner for Smart Badge Creator
 * Runs all test suites and provides comprehensive results
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Smart Badge Creator - Master Test Suite');
console.log('==========================================\n');

const testSuites = [
  {
    name: 'Unit Tests (JSON Parsing Logic)',
    script: 'smart-badge-test.js',
    description: 'Tests JSON parsing, validation, and object detection'
  },
  {
    name: 'Server-side Logic Tests', 
    script: 'server-side-test.js',
    description: 'Tests exact server-side processing logic'
  },
  {
    name: 'Integration Tests (End-to-End)',
    script: 'integration-test.js', 
    description: 'Tests full HTTP request/response cycle'
  },
  {
    name: 'Verification Tests (Badge & Issuer Verification)',
    script: 'verification-test.js',
    description: 'Tests badge verification, issuer validation, and cryptographic signing'
  }
];

function runTest(testSuite) {
  return new Promise((resolve) => {
    console.log(`🚀 Running: ${testSuite.name}`);
    console.log(`📝 ${testSuite.description}`);
    console.log(`📄 Script: ${testSuite.script}\n`);
    
    const child = spawn('node', [path.join(__dirname, testSuite.script)], {
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    child.on('close', (code) => {
      console.log(output);
      
      if (errorOutput) {
        console.log('⚠️  Stderr output:');
        console.log(errorOutput);
      }
      
      const success = code === 0;
      console.log(`${success ? '✅' : '❌'} ${testSuite.name} ${success ? 'PASSED' : 'FAILED'} (exit code: ${code})`);
      console.log('\n' + '='.repeat(60) + '\n');
      
      resolve({ success, code, output, errorOutput });
    });
    
    child.on('error', (error) => {
      console.log(`💥 Error running ${testSuite.name}: ${error.message}`);
      resolve({ success: false, code: -1, output: '', errorOutput: error.message });
    });
  });
}

async function runAllTests() {
  const results = [];
  
  for (const testSuite of testSuites) {
    const result = await runTest(testSuite);
    results.push({ ...testSuite, ...result });
  }
  
  // Summary
  console.log('📊 TEST SUMMARY');
  console.log('================\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    console.log(`${index + 1}. ${result.name}: ${status}`);
    if (!result.success && result.code !== 0) {
      console.log(`   Exit code: ${result.code}`);
    }
  });
  
  console.log(`\n📈 Overall Results:`);
  console.log(`   ✅ Passed: ${passed}/${results.length} test suites`);
  console.log(`   ❌ Failed: ${failed}/${results.length} test suites`);
  console.log(`   📊 Success Rate: ${Math.round((passed / results.length) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL TEST SUITES PASSED!');
    console.log('🏆 Smart Badge Creator is working correctly across all test levels.');
    console.log('\n💡 Your Smart Badge Creator should now handle all edge cases properly:');
    console.log('   • JSON parsing errors with detailed position information');
    console.log('   • Missing or malformed objects');
    console.log('   • Both Open Badges v2.0 and v3.0 formats');
    console.log('   • Various input formatting styles');
    console.log('   • Complete end-to-end badge creation workflows');
  } else {
    console.log('\n⚠️  Some test suites failed.');
    console.log('🔧 Review the detailed output above to identify issues.');
    
    if (results.find(r => r.name.includes('Integration') && !r.success)) {
      console.log('\n💡 Integration test failures might indicate:');
      console.log('   • Server is not running (start with: node server.js)');
      console.log('   • Wrong credentials in test configuration');
      console.log('   • Network connectivity issues');
    }
  }
  
  console.log('\n🔗 For debugging specific position errors:');
  console.log('   1. Use the "Validate JSON" button in the web interface');
  console.log('   2. Check server console logs for detailed error messages');
  console.log('   3. Ensure JSON objects are separated by blank lines');
  console.log('   4. Verify all JSON syntax (commas, brackets, quotes)');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run all tests
runAllTests().catch(error => {
  console.log(`💥 Test runner crashed: ${error.message}`);
  process.exit(1);
});