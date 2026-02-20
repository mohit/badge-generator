#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPublicDomain, normalizePublicDomain } from '../lib/domain-utils.js';

test('PUBLIC_DOMAIN localhost:3000 matches URL host and hostname', () => {
  const config = normalizePublicDomain('localhost:3000');

  assert.equal(config.host, 'localhost:3000');
  assert.equal(config.hostname, 'localhost');
  assert.equal(matchesPublicDomain('http://localhost:3000/issuer/1', config), true);
  assert.equal(matchesPublicDomain('http://localhost/issuer/1', config), true);
});

test('PUBLIC_DOMAIN with scheme still normalizes for matching', () => {
  const config = normalizePublicDomain('https://badge.example.com:8443/path');

  assert.equal(config.host, 'badge.example.com:8443');
  assert.equal(config.hostname, 'badge.example.com');
  assert.equal(matchesPublicDomain('https://badge.example.com:8443/issuer/1', config), true);
  assert.equal(matchesPublicDomain('https://badge.example.com/issuer/1', config), true);
  assert.equal(matchesPublicDomain('https://other.example.com/issuer/1', config), false);
});
