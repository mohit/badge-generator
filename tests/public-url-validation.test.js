#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';

async function loadValidatePublicUrlFor(publicDomain) {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.API_KEY;
  const originalPublicDomain = process.env.PUBLIC_DOMAIN;

  process.env.NODE_ENV = 'test';
  process.env.API_KEY = originalApiKey || 'test-api-key';
  process.env.PUBLIC_DOMAIN = publicDomain;

  const cacheBust = `${Date.now()}-${Math.random()}`;
  const module = await import(`../server.js?public-url-test=${cacheBust}`);
  const validate = module.validatePublicUrl;

  return {
    validate,
    restore() {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalApiKey === undefined) {
        delete process.env.API_KEY;
      } else {
        process.env.API_KEY = originalApiKey;
      }
      if (originalPublicDomain === undefined) {
        delete process.env.PUBLIC_DOMAIN;
      } else {
        process.env.PUBLIC_DOMAIN = originalPublicDomain;
      }
    }
  };
}

test('public URL validator allows configured PUBLIC_DOMAIN host', async () => {
  const ctx = await loadValidatePublicUrlFor('badges.example.invalid');
  try {
    const parsed = await ctx.validate('https://badges.example.invalid/samples/demo-openbadge-v3-signed.json');
    assert.equal(parsed.hostname, 'badges.example.invalid');
  } finally {
    ctx.restore();
  }
});

test('public URL validator still blocks untrusted private IPs', async () => {
  const ctx = await loadValidatePublicUrlFor('badges.example.invalid');
  try {
    await assert.rejects(
      () => ctx.validate('https://10.0.0.4/badges/demo.json'),
      /private\/internal IP address/
    );
  } finally {
    ctx.restore();
  }
});

test('public URL validator does not allow localhost even if PUBLIC_DOMAIN is localhost', async () => {
  const ctx = await loadValidatePublicUrlFor('localhost:3000');
  try {
    await assert.rejects(
      () => ctx.validate('http://localhost:3000/badges/demo.json'),
      /localhost/
    );
  } finally {
    ctx.restore();
  }
});
