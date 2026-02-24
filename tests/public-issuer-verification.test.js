#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

async function importServerModule() {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.API_KEY;

  process.env.NODE_ENV = 'test';
  process.env.API_KEY = originalApiKey || 'test-api-key';

  try {
    const cacheBust = `${Date.now()}-${Math.random()}`;
    return await import(`../server.js?public-issuer-test=${cacheBust}`);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalApiKey === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalApiKey;
    }
  }
}

test('server exposes public issuer verification write endpoint', async () => {
  const serverSource = await fs.readFile('server.js', 'utf8');
  assert.ok(serverSource.includes("app.post('/public/api/issuers/verify'"));
});

test('normalizeIssuerDomainInput accepts URL and bare host forms', async () => {
  const { normalizeIssuerDomainInput } = await importServerModule();

  assert.equal(
    normalizeIssuerDomainInput('https://Example.COM/.well-known/openbadges-issuer.json'),
    'example.com'
  );
  assert.equal(normalizeIssuerDomainInput('demo.example.org'), 'demo.example.org');
  assert.equal(normalizeIssuerDomainInput('demo.example.org:8443/path'), 'demo.example.org:8443');
});

test('createFixedWindowRateLimiter enforces limits and resets after window', async () => {
  const { createFixedWindowRateLimiter } = await importServerModule();
  const limiter = createFixedWindowRateLimiter({ windowMs: 1000, maxRequests: 2 });

  const start = 10_000;
  assert.equal(limiter('ip1', start).allowed, true);
  assert.equal(limiter('ip1', start + 100).allowed, true);
  const blocked = limiter('ip1', start + 200);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
  assert.equal(limiter('ip1', start + 1001).allowed, true);
});
