#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { BadgeCLI } from '../cli/badge-cli.js';

function mockVerificationResult() {
  return {
    valid: true,
    version: 'v3.0',
    verificationLevel: 'cryptographically_verified',
    structure: { valid: true, errors: [], warnings: [] },
    issuer: { valid: true, message: 'Issuer verified' },
    signature: { valid: true, message: 'Signature valid', signatureType: 'Ed25519Signature2020' },
    verifiedAt: new Date().toISOString()
  };
}

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

test('verify-badge uses JSON verification endpoint for local badge files', async () => {
  const cli = new BadgeCLI();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'badge-cli-verify-'));
  const badgePath = path.join(tempDir, 'local-badge.json');
  const badgeData = {
    id: 'https://example.org/badges/local-test.json',
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: { id: 'https://example.org/.well-known/openbadges-issuer.json' },
    credentialSubject: { achievement: { id: 'https://example.org/achievements/demo' } }
  };
  await fs.writeFile(badgePath, JSON.stringify(badgeData, null, 2));

  const captured = { endpoint: null, options: null };
  cli.makeRequest = async (endpoint, options = {}) => {
    captured.endpoint = endpoint;
    captured.options = options;
    return mockVerificationResult();
  };

  try {
    await silenceConsole(async () => {
      await cli.verifyBadge(badgePath);
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  assert.equal(captured.endpoint, '/public/api/verify/json');
  assert.equal(captured.options.method, 'POST');
  const parsedBody = JSON.parse(captured.options.body);
  assert.deepEqual(parsedBody.badgeData, badgeData);
});

test('verify-badge uses URL verification endpoint for remote badge URLs', async () => {
  const cli = new BadgeCLI();
  let capturedEndpoint = null;

  cli.makeRequest = async (endpoint) => {
    capturedEndpoint = endpoint;
    return mockVerificationResult();
  };

  await silenceConsole(async () => {
    await cli.verifyBadge('https://example.org/badges/remote-test.json');
  });

  assert.equal(
    capturedEndpoint,
    '/api/verify/badge/https%3A%2F%2Fexample.org%2Fbadges%2Fremote-test.json'
  );
});
