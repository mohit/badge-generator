#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

const tests = [
  {
    name: 'Domain Validation Tests',
    file: 'tests/domain-validation.test.js',
    description: 'Tests domain validation logic and security'
  },
  {
    name: 'MCP Server Integration Tests', 
    file: 'mcp-server/test.js',
    description: 'Tests MCP server functionality and API integration'
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Running: ${test.name}`);
    console.log(`📝 ${test.description}`);
    console.log(`📄 File: ${test.file}`);
    console.log(`${'='.repeat(60)}\n`);

    const child = spawn('node', [test.file], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      const success = code === 0;
      console.log(`\n${success ? '✅' : '❌'} ${test.name}: ${success ? 'PASSED' : 'FAILED'}`);
      resolve({ name: test.name, success, code });
    });
  });
}

async function runAllTests() {
  console.log('🚀 Badge Generator Test Suite');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🌐 Environment: ${process.env.TEST_BASE_URL || 'https://badge-generator-production.up.railway.app'}`);

  const results = [];
  
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 TEST SUITE SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`Total Test Suites: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (failedTests > 0) {
    console.log('\nFailed Test Suites:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ❌ ${r.name} (exit code: ${r.code})`);
    });
  } else {
    console.log('\n🎉 All test suites passed!');
  }
  
  console.log(`\n📋 Test Coverage:`);
  console.log(`  • Domain validation and security`);
  console.log(`  • API endpoint functionality`);
  console.log(`  • MCP server integration`);
  console.log(`  • Badge creation workflow`);
  console.log(`  • File persistence and retrieval`);
  
  process.exit(failedTests > 0 ? 1 : 0);
}

runAllTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});