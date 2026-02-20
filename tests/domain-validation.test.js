#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('server API surface only references supported routes', async () => {
  const serverSource = await fs.readFile('server.js', 'utf8');

  assert.ok(serverSource.includes("app.post('/api/issuer'"));
  assert.ok(serverSource.includes("app.post('/api/badge-class'"));
  assert.ok(serverSource.includes("app.post('/api/credential-subject'"));
  assert.ok(!serverSource.includes("app.post('/login'"));
  assert.ok(!serverSource.includes("app.post('/create-smart-badge'"));
});

test('legacy CommonJS test files were removed', async () => {
  await assert.rejects(fs.access('tests/integration-test.js'));
  await assert.rejects(fs.access('tests/run-all-tests.js'));
  await assert.rejects(fs.access('tests/server-side-test.js'));
  await assert.rejects(fs.access('tests/smart-badge-test.js'));
});

test('well-known issuer path is standardized to openbadges-issuer.json', async () => {
  const serverSource = await fs.readFile('server.js', 'utf8');
  const cliSource = await fs.readFile('cli/badge-cli.js', 'utf8');
  const domainDoc = await fs.readFile('DOMAIN_VALIDATION.md', 'utf8');

  assert.ok(serverSource.includes('/.well-known/openbadges-issuer.json'));
  assert.ok(serverSource.includes('/.well-known/issuer.json'));
  assert.ok(cliSource.includes('/.well-known/openbadges-issuer.json'));
  assert.ok(!cliSource.includes('/.well-known/issuer.json'));
  assert.ok(domainDoc.includes('/.well-known/openbadges-issuer.json'));
  assert.ok(!domainDoc.includes('/.well-known/issuer.json'));
});
