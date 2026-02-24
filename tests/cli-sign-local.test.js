#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { BadgeCLI } from '../cli/badge-cli.js';

async function withTempDir(run) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'badge-cli-sign-local-'));
  try {
    return await run(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function verifyLocalSignature(signedBadge, publicKeyPem) {
  const unsigned = { ...signedBadge };
  const signature = signedBadge.proof?.jws;
  delete unsigned.proof;

  const canonicalData = JSON.stringify(unsigned, null, 0);
  const dataBuffer = Buffer.from(canonicalData, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'base64url');
  const publicKey = crypto.createPublicKey(publicKeyPem);

  return crypto.verify(null, dataBuffer, publicKey, signatureBuffer);
}

test('signBadgeLocal signs badge with local key and explicit verification method', async () => {
  const cli = new BadgeCLI();
  const badgeData = {
    id: 'https://example.org/assertions/test-1.json',
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: {
      id: 'https://example.org/.well-known/openbadges-issuer.json'
    },
    credentialSubject: {
      achievement: { id: 'https://example.org/achievements/demo' }
    }
  };

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  await withTempDir(async (tempDir) => {
    const privateKeyPath = path.join(tempDir, 'private-key.pem');
    await fs.writeFile(privateKeyPath, privateKey);

    const result = await cli.signBadgeLocal(badgeData, {
      privateKeyFile: privateKeyPath,
      verificationMethod: 'https://example.org/.well-known/openbadges-issuer.json#key'
    });

    assert.equal(result.mode, 'local');
    assert.equal(result.signedBadge.proof.type, 'Ed25519Signature2020');
    assert.equal(
      result.signedBadge.proof.verificationMethod,
      'https://example.org/.well-known/openbadges-issuer.json#key'
    );
    assert.ok(result.signedBadge.proof.jws);
    assert.equal(verifyLocalSignature(result.signedBadge, publicKey), true);
  });
});

test('signBadgeLocal derives verification method from issuer URL in badge payload', async () => {
  const cli = new BadgeCLI();
  const badgeData = {
    id: 'https://demo.example.org/assertions/test-2.json',
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: {
      id: 'https://demo.example.org/.well-known/openbadges-issuer.json'
    },
    credentialSubject: {
      achievement: { id: 'https://demo.example.org/achievements/demo' }
    }
  };

  const { privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  await withTempDir(async (tempDir) => {
    const privateKeyPath = path.join(tempDir, 'private-key.pem');
    await fs.writeFile(privateKeyPath, privateKey);

    const result = await cli.signBadgeLocal(badgeData, {
      privateKeyFile: privateKeyPath
    });

    assert.equal(
      result.verificationMethod,
      'https://demo.example.org/.well-known/openbadges-issuer.json#key'
    );
  });
});
