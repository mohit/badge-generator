#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('server exposes trust discovery and prompt-to-badge public endpoints', async () => {
  const source = await fs.readFile('server.js', 'utf8');

  assert.ok(source.includes("app.get('/public/api/trust/issuer/:domain'"));
  assert.ok(source.includes("app.get('/public/api/trust/events/:domain'"));
  assert.ok(source.includes("app.get('/public/api/trust/issuers'"));
  assert.ok(source.includes("app.post('/public/api/demo/prompt-to-badge'"));
});

test('server trust contract includes trust model fields', async () => {
  const source = await fs.readFile('server.js', 'utf8');

  assert.ok(source.includes('DOMAIN_VERIFIED_SIGNATURE'));
  assert.ok(source.includes('DEMO_DOMAIN_VERIFIED_SIGNATURE'));
  assert.ok(source.includes('UNVERIFIED'));
  assert.ok(source.includes('issuerDomain'));
  assert.ok(source.includes('validationLabel'));
  assert.ok(source.includes('keyFingerprint'));
  assert.ok(source.includes('verificationReason'));
  assert.ok(source.includes('issuerClaimedName'));
  assert.ok(source.includes('DEMO_VALIDATION_LABEL'));
});

test('cli and mcp expose onboarding and explanation tooling', async () => {
  const cliSource = await fs.readFile('cli/badge-cli.js', 'utf8');
  const mcpSource = await fs.readFile('mcp-server/index.js', 'utf8');

  assert.ok(cliSource.includes(".command('onboard-issuer')"));
  assert.ok(cliSource.includes('Trust State:'));
  assert.ok(cliSource.includes('Validation Label:'));

  assert.ok(mcpSource.includes("name: 'generate_issuer_profile_template'"));
  assert.ok(mcpSource.includes("name: 'issue_sample_badge'"));
  assert.ok(mcpSource.includes("name: 'explain_verification_result'"));
  assert.ok(mcpSource.includes('Validation Label:'));
});
