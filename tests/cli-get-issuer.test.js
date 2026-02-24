#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import { BadgeCLI } from '../cli/badge-cli.js';

test('get-issuer with --log-trust reads nested issuer fields from API response', async () => {
  const cli = new BadgeCLI();

  cli.makeRequest = async () => ({
    status: 'verified',
    issuer: {
      displayName: 'Demo University',
      lastUpdated: '2025-01-01T00:00:00.000Z',
      url: 'https://demo.example.org',
      wellKnownUrl: 'https://demo.example.org/.well-known/openbadges-issuer.json'
    }
  });

  const logs = [];
  const originalLog = console.log;

  console.log = (...args) => {
    logs.push(args.join(' '));
  };

  try {
    await cli.getVerifiedIssuer('demo.example.org', { logTrust: true });
  } finally {
    console.log = originalLog;
  }

  const output = logs.join('\n');
  assert.match(output, /Name: Demo University/);
  assert.match(output, /Status: verified/);
  assert.match(output, /Verified: Yes/);
  assert.match(output, /Well-Known URL: https:\/\/demo\.example\.org\/\.well-known\/openbadges-issuer\.json/);
});
