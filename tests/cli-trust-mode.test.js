#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import { BadgeCLI } from '../cli/badge-cli.js';

async function silenceConsole(run) {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    await run();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test('verify uses public issuer endpoint by default (no trust write)', async () => {
  const cli = new BadgeCLI();
  cli.config = { baseUrl: 'https://badges.firmament.works', apiKey: '' };

  let capturedEndpoint = null;
  cli.makeRequest = async (endpoint) => {
    capturedEndpoint = endpoint;
    return {
      valid: true,
      verification: { valid: true, message: 'Issuer verified' }
    };
  };

  await silenceConsole(async () => {
    await cli.verifyIssuer('demo.example.org');
  });

  assert.equal(
    capturedEndpoint,
    '/public/api/verify/issuer/https%3A%2F%2Fdemo.example.org%2F.well-known%2Fopenbadges-issuer.json'
  );
});

test('verify with --log-trust uses trust-log API write and requires API key mode', async () => {
  const cli = new BadgeCLI();
  cli.config = { baseUrl: 'https://badges.firmament.works', apiKey: 'test-key' };
  let capturedEndpoint = null;
  let capturedOptions = null;
  let capturedRequestConfig = null;

  cli.makeRequest = async (endpoint, options, requestConfig) => {
    capturedEndpoint = endpoint;
    capturedOptions = options;
    capturedRequestConfig = requestConfig;
    return { status: 'verified', message: 'ok' };
  };

  await silenceConsole(async () => {
    await cli.verifyIssuer('demo.example.org', { logTrust: true, force: true });
  });

  assert.equal(capturedEndpoint, '/api/issuers/verify');
  assert.equal(capturedOptions.method, 'POST');
  assert.deepEqual(JSON.parse(capturedOptions.body), {
    domain: 'demo.example.org',
    force: true
  });
  assert.equal(capturedRequestConfig.requireApiKey, true);
});

test('makeRequest enforces API key only when required', async () => {
  const cli = new BadgeCLI();
  cli.config = { baseUrl: 'https://badges.firmament.works', apiKey: '' };

  await assert.rejects(
    () => cli.makeRequest('/api/issuer', { method: 'POST', body: '{}' }, { requireApiKey: true }),
    /API key not configured/
  );
});
