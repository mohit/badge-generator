import express from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { promises as dns } from 'dns';
import net from 'net';
import { config } from 'dotenv';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { normalizePublicDomain } from './lib/domain-utils.js';

// ---------------------------------------------------------------------------
// SSRF protection: block requests to private/internal networks from public
// verification endpoints that accept user-controlled URLs.
// ---------------------------------------------------------------------------
const SSRF_BLOCKED_CIDRS = [
  // IPv4 private ranges
  { prefix: '10.', exact: false },
  { prefix: '172.', test: (ip) => { const b = parseInt(ip.split('.')[1], 10); return b >= 16 && b <= 31; } },
  { prefix: '192.168.', exact: false },
  // Loopback
  { prefix: '127.', exact: false },
  // Link-local
  { prefix: '169.254.', exact: false },
  // Cloud metadata (AWS, GCP, Azure)
  { prefix: '169.254.169.254', exact: true },
  { prefix: 'fd00:', exact: false }, // IPv6 ULA
  { prefix: '::1', exact: true },    // IPv6 loopback
];

function isPrivateIp(ip) {
  if (!ip) return true; // fail-closed
  for (const rule of SSRF_BLOCKED_CIDRS) {
    if (rule.exact) {
      if (ip === rule.prefix) return true;
    } else if (rule.test) {
      if (ip.startsWith(rule.prefix) && rule.test(ip)) return true;
    } else {
      if (ip.startsWith(rule.prefix)) return true;
    }
  }
  return false;
}

/**
 * Validate that a URL is safe for server-side fetch from a public endpoint.
 * Resolves the hostname via DNS and rejects private/internal IPs.
 */
export async function validatePublicUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('Invalid URL');
  }

  // Only allow http(s)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }

  const hostname = parsed.hostname;
  const normalizedHost = parsed.host.toLowerCase();
  const normalizedHostname = hostname.toLowerCase();
  const trustedPublicDomain = normalizePublicDomain(process.env.PUBLIC_DOMAIN || 'localhost:3000');

  // Allow fetches to the configured public domain (hosted sample badges,
  // issuer profile, etc.), even when internal platform DNS resolves privately.
  const trustedIsLocalhost = trustedPublicDomain.hostname === 'localhost' || trustedPublicDomain.hostname === '::1';
  const trustedIsIp = net.isIP(trustedPublicDomain.hostname);
  const trustedIsPrivateIp = trustedIsIp && isPrivateIp(trustedPublicDomain.hostname);
  const trustedDomainAllowed = !trustedIsLocalhost && !trustedIsPrivateIp;

  if (
    trustedDomainAllowed &&
    (normalizedHost === trustedPublicDomain.host ||
      normalizedHostname === trustedPublicDomain.hostname)
  ) {
    return parsed;
  }

  // Allow reserved example.com domains for demo/test verification flows.
  if (isExampleDemoDomain(normalizedHost) || isExampleDemoDomain(normalizedHostname)) {
    return parsed;
  }

  // Reject obvious private hostnames
  if (hostname === 'localhost' || hostname === '[::1]') {
    throw new Error('Requests to localhost are not allowed from public endpoints');
  }

  // Resolve DNS and check all IPs (supports A-only, AAAA-only, and dual-stack)
  try {
    let addresses;
    if (net.isIP(hostname)) {
      addresses = [hostname];
    } else {
      const [v4, v6] = await Promise.all([
        dns.resolve4(hostname).catch(() => []),
        dns.resolve6(hostname).catch(() => [])
      ]);
      addresses = v4.concat(v6);
      if (addresses.length === 0) {
        throw new Error(`Cannot resolve hostname: ${hostname}`);
      }
    }

    for (const addr of addresses) {
      if (isPrivateIp(addr)) {
        throw new Error('URL resolves to a private/internal IP address');
      }
    }
  } catch (err) {
    if (err.message.includes('private') || err.message.includes('localhost') || err.message.includes('Cannot resolve')) throw err;
    throw new Error(`Cannot resolve hostname: ${hostname}`);
  }

  return parsed;
}

export function normalizeIssuerDomainInput(domainInput) {
  const raw = String(domainInput || '').trim();
  if (!raw) {
    throw new Error('Domain is required');
  }

  let host = raw;
  if (raw.includes('://')) {
    host = new URL(raw).host;
  } else {
    host = raw.split('/')[0];
  }

  host = host.trim().toLowerCase();
  if (!host) {
    throw new Error('Invalid domain format');
  }

  const parsed = new URL(`https://${host}`);
  return parsed.host.toLowerCase();
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function createFixedWindowRateLimiter({ windowMs, maxRequests }) {
  const bucket = new Map();

  return function consume(key, now = Date.now()) {
    const current = bucket.get(key);
    if (!current || now >= current.resetAt) {
      bucket.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        retryAfterSeconds: 0
      };
    }

    if (current.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      };
    }

    current.count += 1;
    bucket.set(key, current);
    return {
      allowed: true,
      remaining: maxRequests - current.count,
      retryAfterSeconds: 0
    };
  };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

config();

if (process.env.NODE_ENV !== 'test' && !process.env.API_KEY) {
  console.error('Missing required environment variable: API_KEY');
  process.exit(1);
}

// Domain validation constants
const VERIFIED_ISSUER_DOMAIN = normalizePublicDomain(process.env.PUBLIC_DOMAIN || 'localhost:3000');
const SAFE_TEST_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
  'test.example.com',
  'demo.example.org',
  'localhost',
  '127.0.0.1'
];
const WELL_KNOWN_ISSUER_PATH = '/.well-known/openbadges-issuer.json';
const LEGACY_WELL_KNOWN_ISSUER_PATH = '/.well-known/issuer.json';
const DEMO_DOMAIN_SUFFIX = 'example.com';
const DEMO_VALIDATION_LABEL = 'DEMO';
const DEMO_ISSUER_PROFILE_PATH = path.resolve('public', 'samples', 'demo-example-com-issuer.json');
const DEMO_PRIVATE_KEY_PATHS = [
  path.resolve('demo-keys', 'example.com-private-key.txt'),
  path.resolve('demo-keys', 'example.com-private-key.pem')
];
const DEMO_PUBLIC_KEY_PATHS = [
  path.resolve('demo-keys', 'example.com-public-key.txt'),
  path.resolve('demo-keys', 'example.com-public-key.pem')
];
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || 'uploads');
const TRUST_STATES = Object.freeze({
  UNVERIFIED: 'UNVERIFIED',
  DOMAIN_VERIFIED_SIGNATURE: 'DOMAIN_VERIFIED_SIGNATURE',
  DEMO_DOMAIN_VERIFIED_SIGNATURE: 'DEMO_DOMAIN_VERIFIED_SIGNATURE'
});
const PUBLIC_ISSUER_VERIFY_WINDOW_MS = parsePositiveInt(
  process.env.PUBLIC_ISSUER_VERIFY_WINDOW_MS || '3600000',
  3600000
);
const PUBLIC_ISSUER_VERIFY_MAX_REQUESTS = parsePositiveInt(
  process.env.PUBLIC_ISSUER_VERIFY_MAX_REQUESTS || '10',
  10
);
const publicIssuerVerifyRateLimit = createFixedWindowRateLimiter({
  windowMs: PUBLIC_ISSUER_VERIFY_WINDOW_MS,
  maxRequests: PUBLIC_ISSUER_VERIFY_MAX_REQUESTS
});
const PUBLIC_VERIFY_WINDOW_MS = parsePositiveInt(
  process.env.PUBLIC_VERIFY_WINDOW_MS || '60000',
  60000
);
const PUBLIC_VERIFY_MAX_REQUESTS = parsePositiveInt(
  process.env.PUBLIC_VERIFY_MAX_REQUESTS || '60',
  60
);
const PUBLIC_VERIFY_MAX_CONCURRENT = parsePositiveInt(
  process.env.PUBLIC_VERIFY_MAX_CONCURRENT || '20',
  20
);
const publicVerifyRateLimit = createFixedWindowRateLimiter({
  windowMs: PUBLIC_VERIFY_WINDOW_MS,
  maxRequests: PUBLIC_VERIFY_MAX_REQUESTS
});
const PUBLIC_ISSUER_VERIFY_DOMAIN_COOLDOWN_MS = parsePositiveInt(
  process.env.PUBLIC_ISSUER_VERIFY_DOMAIN_COOLDOWN_MS || '300000',
  300000
);
const PUBLIC_PROMPT_BADGE_WINDOW_MS = parsePositiveInt(
  process.env.PUBLIC_PROMPT_BADGE_WINDOW_MS || '600000',
  600000
);
const PUBLIC_PROMPT_BADGE_MAX_REQUESTS = parsePositiveInt(
  process.env.PUBLIC_PROMPT_BADGE_MAX_REQUESTS || '8',
  8
);
const publicPromptBadgeRateLimit = createFixedWindowRateLimiter({
  windowMs: PUBLIC_PROMPT_BADGE_WINDOW_MS,
  maxRequests: PUBLIC_PROMPT_BADGE_MAX_REQUESTS
});

const publicIssuerDomainCooldown = new Map();
let activePublicVerifyJobs = 0;
let demoIssuerTemplateCache = null;
let demoPublicKeyPemCache = null;
let demoPrivateKeyPemCache = null;

const runtimeMetrics = {
  externalFetchCount: 0,
  trustWriteRequests: 0,
  verificationRequests: 0,
  keyCacheHits: 0,
  keyCacheMisses: 0,
  promptBadgeRequests: 0
};

function uploadsPath(...parts) {
  return path.join(UPLOADS_DIR, ...parts);
}

function incrementMetric(metricName, amount = 1) {
  if (!Object.prototype.hasOwnProperty.call(runtimeMetrics, metricName)) {
    return;
  }
  runtimeMetrics[metricName] += amount;
}

function getRuntimeMetricsSnapshot() {
  const totalKeyLookups = runtimeMetrics.keyCacheHits + runtimeMetrics.keyCacheMisses;
  const keyCacheHitRate = totalKeyLookups > 0
    ? runtimeMetrics.keyCacheHits / totalKeyLookups
    : 0;

  return {
    ...runtimeMetrics,
    keyCacheHitRate: Number(keyCacheHitRate.toFixed(4)),
    generatedAt: new Date().toISOString()
  };
}

function normalizeDomainOrHost(input) {
  if (!input) return null;

  try {
    return normalizeIssuerDomainInput(input);
  } catch {
    return null;
  }
}

function toHostname(hostOrDomain) {
  const normalized = normalizeDomainOrHost(hostOrDomain);
  if (!normalized) return null;
  return normalized.split(':')[0];
}

function isExampleDemoDomain(hostOrDomain) {
  const hostname = toHostname(hostOrDomain);
  if (!hostname) return false;
  return hostname === DEMO_DOMAIN_SUFFIX || hostname.endsWith(`.${DEMO_DOMAIN_SUFFIX}`);
}

function getValidationLabelForDomain(hostOrDomain) {
  return isExampleDemoDomain(hostOrDomain) ? DEMO_VALIDATION_LABEL : null;
}

function readOptionalPem(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function publicKeyPemToMultibase(publicKeyPem) {
  if (!publicKeyPem) return null;
  try {
    const keyDer = crypto.createPublicKey(publicKeyPem).export({
      type: 'spki',
      format: 'der'
    });
    return `z${Buffer.from(keyDer).toString('base64url')}`;
  } catch {
    return null;
  }
}

function loadDemoPublicKeyPem() {
  if (demoPublicKeyPemCache) return demoPublicKeyPemCache;
  if (process.env.DEMO_EXAMPLE_PUBLIC_KEY) {
    demoPublicKeyPemCache = process.env.DEMO_EXAMPLE_PUBLIC_KEY;
    return demoPublicKeyPemCache;
  }
  for (const keyPath of DEMO_PUBLIC_KEY_PATHS) {
    const fileKey = readOptionalPem(keyPath);
    if (fileKey) {
      demoPublicKeyPemCache = fileKey;
      break;
    }
  }
  return demoPublicKeyPemCache;
}

function loadDemoPrivateKeyPem() {
  if (demoPrivateKeyPemCache) return demoPrivateKeyPemCache;
  if (process.env.DEMO_EXAMPLE_PRIVATE_KEY) {
    demoPrivateKeyPemCache = process.env.DEMO_EXAMPLE_PRIVATE_KEY;
    return demoPrivateKeyPemCache;
  }
  for (const keyPath of DEMO_PRIVATE_KEY_PATHS) {
    const fileKey = readOptionalPem(keyPath);
    if (fileKey) {
      demoPrivateKeyPemCache = fileKey;
      break;
    }
  }
  return demoPrivateKeyPemCache;
}

function loadDemoIssuerTemplate() {
  if (demoIssuerTemplateCache) return demoIssuerTemplateCache;
  try {
    demoIssuerTemplateCache = JSON.parse(fs.readFileSync(DEMO_ISSUER_PROFILE_PATH, 'utf8'));
    return demoIssuerTemplateCache;
  } catch {
    return null;
  }
}

function buildDemoIssuerProfile(issuerUrl) {
  const parsed = new URL(issuerUrl);
  const origin = `${parsed.protocol}//${parsed.host}`;
  const wellKnownUrl = `${origin}${WELL_KNOWN_ISSUER_PATH}`;
  const template = loadDemoIssuerTemplate() || {};
  const demoPublicKeyPem = loadDemoPublicKeyPem();
  const templateMultibase = template?.publicKey?.publicKeyMultibase ||
    (Array.isArray(template?.publicKeys) ? template.publicKeys[0]?.publicKeyMultibase : null);
  const publicKeyMultibase = publicKeyPemToMultibase(demoPublicKeyPem) || templateMultibase;

  const profile = {
    '@context': template['@context'] || [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'
    ],
    id: wellKnownUrl,
    type: template.type || 'Profile',
    name: template.name || 'EXAMPLE.com Demo Issuer',
    url: origin,
    email: template.email || 'demo@example.com',
    description: template.description || 'Demonstration issuer profile for reserved example.com domains.',
    official: true,
    verified: true
  };

  if (publicKeyMultibase) {
    profile.publicKey = {
      id: `${wellKnownUrl}#key`,
      type: 'Ed25519VerificationKey2020',
      controller: wellKnownUrl,
      publicKeyMultibase
    };
  }

  if (demoPublicKeyPem) {
    profile.publicKeyPem = demoPublicKeyPem;
  }

  return profile;
}

function toPublicKeyPem(maybeKey) {
  if (!maybeKey) return null;
  if (typeof maybeKey === 'string') {
    return maybeKey.includes('BEGIN PUBLIC KEY') ? maybeKey : null;
  }

  if (typeof maybeKey !== 'object') {
    return null;
  }

  if (typeof maybeKey.publicKeyPem === 'string') {
    return maybeKey.publicKeyPem;
  }

  if (typeof maybeKey.publicKeyMultibase === 'string' && maybeKey.publicKeyMultibase.startsWith('z')) {
    try {
      const keyBuffer = Buffer.from(maybeKey.publicKeyMultibase.slice(1), 'base64url');
      const exported = crypto.createPublicKey({
        key: keyBuffer,
        format: 'der',
        type: 'spki'
      }).export({ type: 'spki', format: 'pem' });
      return String(exported);
    } catch {
      return null;
    }
  }

  return null;
}

function computeKeyFingerprint(publicKeyPem) {
  if (!publicKeyPem) return null;

  try {
    const keyDer = crypto.createPublicKey(publicKeyPem).export({
      type: 'spki',
      format: 'der'
    });
    const digest = crypto.createHash('sha256').update(keyDer).digest('hex');
    return `sha256:${digest}`;
  } catch {
    return null;
  }
}

function extractIssuerDomainFromVerification(issuerVerification) {
  if (!issuerVerification?.issuer) return null;

  const sourceUrl = issuerVerification.issuer.wellKnownUrl ||
    issuerVerification.issuer.id ||
    issuerVerification.issuer.url;

  if (!sourceUrl) return null;

  return normalizeDomainOrHost(sourceUrl);
}

function extractIssuerClaimedName(issuerVerification) {
  if (!issuerVerification?.issuer) return null;
  return issuerVerification.issuer.displayName || issuerVerification.issuer.name || null;
}

function determineTrustState(structureVerification, issuerVerification, signatureVerification) {
  if (
    structureVerification?.valid &&
    issuerVerification?.valid &&
    signatureVerification?.valid &&
    signatureVerification?.keyDiscoverable === true &&
    signatureVerification?.domainBound === true
  ) {
    return TRUST_STATES.DOMAIN_VERIFIED_SIGNATURE;
  }

  return TRUST_STATES.UNVERIFIED;
}

function determineVerificationReason(trustState) {
  if (trustState === TRUST_STATES.DOMAIN_VERIFIED_SIGNATURE) {
    return 'Signature is valid and key is currently discoverable for this domain.';
  }
  if (trustState === TRUST_STATES.DEMO_DOMAIN_VERIFIED_SIGNATURE) {
    return 'Signature is valid. Issuer uses the reserved example.com demo domain.';
  }
  return 'Issuer cannot be cryptographically verified.';
}

function trustEventsPath() {
  return uploadsPath('trust-events.json');
}

function loadTrustEvents() {
  const filePath = trustEventsPath();
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (error) {
      console.error('Error loading trust events:', error);
    }
  }
  return {};
}

function saveTrustEvents(eventsByDomain) {
  ensureUploadsDir();
  fs.writeFileSync(trustEventsPath(), JSON.stringify(eventsByDomain, null, 2));
}

function appendTrustEvent(domain, event) {
  const eventsByDomain = loadTrustEvents();
  const existing = Array.isArray(eventsByDomain[domain]) ? eventsByDomain[domain] : [];
  const nextEvent = {
    id: uuidv4(),
    domain,
    timestamp: new Date().toISOString(),
    ...event
  };
  existing.unshift(nextEvent);
  eventsByDomain[domain] = existing.slice(0, 200);
  saveTrustEvents(eventsByDomain);
  return nextEvent;
}

function getTrustEvents(domain) {
  const eventsByDomain = loadTrustEvents();
  return Array.isArray(eventsByDomain[domain]) ? eventsByDomain[domain] : [];
}

function consumePublicIssuerCooldown(domain, now = Date.now()) {
  const existing = publicIssuerDomainCooldown.get(domain);
  if (existing && now < existing) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing - now) / 1000))
    };
  }

  publicIssuerDomainCooldown.set(domain, now + PUBLIC_ISSUER_VERIFY_DOMAIN_COOLDOWN_MS);
  return {
    allowed: true,
    retryAfterSeconds: 0
  };
}

function buildTrustPayload({ structure, issuer, signature }) {
  let trustState = determineTrustState(structure, issuer, signature);
  const issuerDomain = extractIssuerDomainFromVerification(issuer);
  const issuerClaimedName = extractIssuerClaimedName(issuer);
  const validationLabel = getValidationLabelForDomain(issuerDomain);
  const fallbackIssuerPem = toPublicKeyPem(issuer?.issuer?.publicKey) ||
    (Array.isArray(issuer?.issuer?.publicKeys) ? toPublicKeyPem(issuer.issuer.publicKeys[0]) : null);
  const keyFingerprint = signature?.keyFingerprint || computeKeyFingerprint(fallbackIssuerPem) || null;

  if (trustState === TRUST_STATES.DOMAIN_VERIFIED_SIGNATURE && validationLabel === DEMO_VALIDATION_LABEL) {
    trustState = TRUST_STATES.DEMO_DOMAIN_VERIFIED_SIGNATURE;
  }

  return {
    trustState,
    issuerDomain,
    validationLabel,
    keyFingerprint,
    verificationReason: determineVerificationReason(trustState),
    issuerClaimedName
  };
}

function buildIssuerTrustPayload(issuerVerification) {
  const issuerDomain = issuerVerification?.issuerDomain ||
    extractIssuerDomainFromVerification(issuerVerification) ||
    null;
  const validationLabel = issuerVerification?.validationLabel || getValidationLabelForDomain(issuerDomain);
  const fallbackIssuerPem = toPublicKeyPem(issuerVerification?.issuer?.publicKey) ||
    (Array.isArray(issuerVerification?.issuer?.publicKeys) ? toPublicKeyPem(issuerVerification.issuer.publicKeys[0]) : null);
  const keyFingerprint = issuerVerification?.keyFingerprint || computeKeyFingerprint(fallbackIssuerPem) || null;
  let trustState = issuerVerification?.valid && keyFingerprint
    ? TRUST_STATES.DOMAIN_VERIFIED_SIGNATURE
    : TRUST_STATES.UNVERIFIED;

  if (trustState === TRUST_STATES.DOMAIN_VERIFIED_SIGNATURE && validationLabel === DEMO_VALIDATION_LABEL) {
    trustState = TRUST_STATES.DEMO_DOMAIN_VERIFIED_SIGNATURE;
  }

  return {
    trustState,
    issuerDomain,
    validationLabel,
    keyFingerprint,
    verificationReason: trustState === TRUST_STATES.DEMO_DOMAIN_VERIFIED_SIGNATURE
      ? 'Issuer profile is reachable and key is discoverable. Issuer uses the reserved example.com demo domain.'
      : trustState === TRUST_STATES.DOMAIN_VERIFIED_SIGNATURE
        ? 'Issuer profile is reachable and key is discoverable for this domain.'
        : determineVerificationReason(TRUST_STATES.UNVERIFIED),
    issuerClaimedName: issuerVerification?.issuerClaimedName || extractIssuerClaimedName(issuerVerification) || null
  };
}

function unverifiedTrustPayload() {
  return {
    trustState: TRUST_STATES.UNVERIFIED,
    issuerDomain: null,
    validationLabel: null,
    keyFingerprint: null,
    verificationReason: determineVerificationReason(TRUST_STATES.UNVERIFIED),
    issuerClaimedName: null,
    trustCaveat: 'This verifies domain/key control. It does not certify assessment quality or accreditation.'
  };
}

function getWellKnownIssuerUrls(domain) {
  return [
    `https://${domain}${WELL_KNOWN_ISSUER_PATH}`,
    `https://${domain}${LEGACY_WELL_KNOWN_ISSUER_PATH}`
  ];
}

// Domain validation function
async function validateIssuerDomain(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    const host = urlObj.host.toLowerCase();

    // Check if it's our verified issuer
    if (host === VERIFIED_ISSUER_DOMAIN.host || domain === VERIFIED_ISSUER_DOMAIN.hostname) {
      return {
        valid: true,
        type: 'verified',
        warnings: [],
        message: 'Using verified Badge Generator issuer'
      };
    }

    // Check if it's a verified external issuer
    const verifiedIssuer = getVerifiedIssuer(domain);
    if (verifiedIssuer && verifiedIssuer.status === 'verified') {
      return {
        valid: true,
        type: 'verified-external',
        warnings: [],
        message: `Using verified issuer: ${verifiedIssuer.displayName}`,
        issuer: verifiedIssuer
      };
    }

    // Check if it's a safe testing domain
    const isSafeTestDomain = SAFE_TEST_DOMAINS.some(safeDomain =>
      domain === safeDomain || domain.endsWith('.' + safeDomain)
    );

    if (isSafeTestDomain) {
      return {
        valid: true,
        type: 'testing',
        warnings: ['Using example.com domain - safe for testing only'],
        message: 'Safe testing domain'
      };
    }

    // Check if domain is registered (block real domains unless verified)
    try {
      await dns.lookup(domain);
      // Domain exists - check if it has a failed verification record
      if (verifiedIssuer && verifiedIssuer.status === 'failed') {
        return {
          valid: false,
          type: 'verification-failed',
          warnings: [],
          message: `Domain '${domain}' verification failed. Please fix your /.well-known/openbadges-issuer.json file and re-verify.`,
          error: 'VERIFICATION_FAILED',
          lastError: verifiedIssuer.lastError
        };
      }

      // Domain exists but not verified - suggest verification
      return {
        valid: false,
        type: 'unverified',
        warnings: [],
        message: `Domain '${domain}' appears to be registered but not verified. Please verify your domain using /api/issuers/verify or use example.com domains for testing.`,
        error: 'DOMAIN_UNVERIFIED'
      };
    } catch (err) {
      // Domain doesn't exist - allow it (might be local/test domain)
      return {
        valid: true,
        type: 'unregistered',
        warnings: ['Using unregistered domain - ensure this is intentional'],
        message: 'Unregistered domain allowed'
      };
    }

  } catch (err) {
    return {
      valid: false,
      type: 'invalid',
      warnings: [],
      message: 'Invalid URL format',
      error: 'INVALID_URL'
    };
  }
}

// Helper function to ensure uploads directory exists
function ensureUploadsDir() {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.accessSync(UPLOADS_DIR, fs.constants.W_OK);
  } catch (error) {
    throw new Error(`Uploads directory is not writable: ${UPLOADS_DIR} (${error.message})`);
  }
}

// Helper functions for verified issuer storage
function loadVerifiedIssuers() {
  const filePath = uploadsPath('verified-issuers.json');
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error('Error loading verified issuers:', error);
      return {};
    }
  }
  return {};
}

function saveVerifiedIssuers(issuers) {
  ensureUploadsDir();
  const filePath = uploadsPath('verified-issuers.json');
  fs.writeFileSync(filePath, JSON.stringify(issuers, null, 2));
}

function getVerifiedIssuer(domain) {
  const issuers = loadVerifiedIssuers();
  return issuers[domain] || null;
}

function setVerifiedIssuer(domain, issuerData) {
  const issuers = loadVerifiedIssuers();
  issuers[domain] = {
    ...issuerData,
    lastUpdated: new Date().toISOString()
  };
  saveVerifiedIssuers(issuers);
  return issuers[domain];
}

// Verify issuer by fetching their well-known file
async function verifyIssuerDomain(domain, options = {}) {
  const { validateUrl } = options;
  try {
    console.log(`Verifying issuer domain: ${domain}`);
    const wellKnownUrls = getWellKnownIssuerUrls(domain);
    let response = null;
    let wellKnownUrl = null;
    const blockedUrls = [];
    const fetchErrors = [];

    for (const candidateUrl of wellKnownUrls) {
      try {
        if (validateUrl) {
          await validateUrl(candidateUrl);
        }

        console.log(`Fetching: ${candidateUrl}`);
        incrementMetric('externalFetchCount');
        const candidateResponse = await fetch(candidateUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Badge-Generator-Verifier/1.0'
          }
        });

        if (candidateResponse.ok) {
          response = candidateResponse;
          wellKnownUrl = candidateUrl;
          break;
        }
      } catch (error) {
        const message = error?.message || 'Unknown error';
        if (
          message.includes('private') ||
          message.includes('localhost') ||
          message.includes('Cannot resolve')
        ) {
          blockedUrls.push({ url: candidateUrl, reason: message });
        } else {
          fetchErrors.push({ url: candidateUrl, reason: message });
        }
      }
    }

    if (!response || !wellKnownUrl) {
      if (blockedUrls.length === wellKnownUrls.length) {
        return {
          success: false,
          error: 'Blocked by public safety policy',
          details: {
            domain,
            blockedUrls
          }
        };
      }

      return {
        success: false,
        error: 'Failed to fetch issuer well-known file from supported paths',
        details: {
          urls: wellKnownUrls,
          blockedUrls,
          fetchErrors
        }
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {
        success: false,
        error: `Well-known file is not JSON (content-type: ${contentType})`,
        details: { url: wellKnownUrl, contentType }
      };
    }

    let issuerData;
    try {
      issuerData = await response.json();
    } catch (parseError) {
      return {
        success: false,
        error: `Invalid JSON in well-known file: ${parseError.message}`,
        details: { url: wellKnownUrl }
      };
    }

    // Validate required fields
    const requiredFields = ['id', 'type', 'name'];
    const missingFields = requiredFields.filter(field => !issuerData[field]);

    if (missingFields.length > 0) {
      return {
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        details: { url: wellKnownUrl, missingFields }
      };
    }

    // Validate that the ID matches the well-known URL or domain
    const validIds = [
      wellKnownUrl,
      `https://${domain}`,
      `https://${domain}/`,
      `https://${domain}${WELL_KNOWN_ISSUER_PATH}`,
      `https://${domain}${LEGACY_WELL_KNOWN_ISSUER_PATH}`
    ];

    if (!validIds.includes(issuerData.id)) {
      return {
        success: false,
        error: `Issuer ID '${issuerData.id}' does not match domain '${domain}'`,
        details: {
          url: wellKnownUrl,
          issuerId: issuerData.id,
          expectedIds: validIds
        }
      };
    }

    // Validate type (Open Badges v2.0 or v3.0)
    const validTypes = ['Issuer', 'Profile'];
    if (!validTypes.includes(issuerData.type)) {
      return {
        success: false,
        error: `Invalid type '${issuerData.type}'. Must be 'Issuer' or 'Profile'`,
        details: { url: wellKnownUrl, type: issuerData.type }
      };
    }

    const issuerPublicKeyPem = toPublicKeyPem(issuerData.publicKey) ||
      (Array.isArray(issuerData.publicKeys) ? toPublicKeyPem(issuerData.publicKeys[0]) : null);
    const keyFingerprint = computeKeyFingerprint(issuerPublicKeyPem);

    // Success - store the verified issuer
    const verifiedIssuer = {
      id: issuerData.id,
      domain: domain,
      status: 'verified',
      displayName: issuerData.name,
      type: issuerData.type,
      url: issuerData.url || `https://${domain}`,
      email: issuerData.email,
      description: issuerData.description,
      publicKeys: issuerData.publicKey ? [issuerData.publicKey] : (issuerData.publicKeys || []),
      publicKeyFingerprint: keyFingerprint,
      wellKnownUrl: wellKnownUrl,
      lastVerified: new Date().toISOString(),
      verificationMethod: 'well-known',
      rawData: issuerData // Store original for debugging
    };

    setVerifiedIssuer(domain, verifiedIssuer);

    return {
      success: true,
      issuer: verifiedIssuer,
      message: `Successfully verified issuer: ${issuerData.name}`
    };

  } catch (error) {
    console.error(`Error verifying issuer ${domain}:`, error);
    return {
      success: false,
      error: `Verification failed: ${error.message}`,
      details: { domain, errorType: error.name }
    };
  }
}

// Ensure uploads directory exists and is writable at startup
try {
  ensureUploadsDir();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: process.env.MAX_JSON_BODY || '256kb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_FORM_BODY || '128kb' }));

app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  return next(err);
});

// Serve static files
app.use('/badges', express.static(UPLOADS_DIR));
app.use(express.static('public'));

function applyPublicVerifyRateLimit(req, res, next) {
  const clientIp = getClientIp(req);
  const rate = publicVerifyRateLimit(clientIp);
  if (!rate.allowed) {
    res.set('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({
      error: 'Rate limit exceeded for public verification requests',
      retryAfterSeconds: rate.retryAfterSeconds,
      limits: {
        maxRequests: PUBLIC_VERIFY_MAX_REQUESTS,
        windowMs: PUBLIC_VERIFY_WINDOW_MS
      }
    });
  }
  return next();
}

function applyPublicVerifyConcurrencyLimit(req, res, next) {
  if (activePublicVerifyJobs >= PUBLIC_VERIFY_MAX_CONCURRENT) {
    return res.status(429).json({
      error: 'Public verifier is at concurrency capacity. Retry shortly.',
      limits: {
        maxConcurrent: PUBLIC_VERIFY_MAX_CONCURRENT
      }
    });
  }

  activePublicVerifyJobs += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activePublicVerifyJobs = Math.max(0, activePublicVerifyJobs - 1);
  };

  res.on('finish', release);
  res.on('close', release);
  return next();
}

// Middleware to check API key
export const requireApiKey = (req, res, next) => {
  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'Server API key is not configured' });
  }

  const apiKey = req.headers['x-api-key'];
  if (apiKey === process.env.API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid API key' });
  }
};

// API endpoint to list uploaded files (API key auth)
app.get('/api/badge-files', requireApiKey, (req, res) => {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to read files' });
    }

    const fileList = files
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        url: `/badges/${file}`,
        fullUrl: `${req.protocol}://${req.get('host')}/badges/${file}`
      }));

    res.json(fileList);
  });
});

app.get('/api/metrics', requireApiKey, (req, res) => {
  res.json(getRuntimeMetricsSnapshot());
});

// Domain validation endpoint
app.get('/api/validate-issuer-domain', requireApiKey, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  const validation = await validateIssuerDomain(url);
  res.json(validation);
});

// Issuer verification endpoints
app.post('/api/issuers/verify', requireApiKey, async (req, res) => {
  const { domain } = req.body || {};
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  let normalizedDomain;
  try {
    normalizedDomain = normalizeIssuerDomainInput(domain);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid domain format' });
  }

  incrementMetric('trustWriteRequests');

  const result = await verifyIssuerDomain(normalizedDomain);

  if (result.success) {
    appendTrustEvent(normalizedDomain, {
      action: 'verify_issuer_domain',
      outcome: 'verified',
      source: 'admin_api',
      keyFingerprint: result.issuer?.publicKeyFingerprint || null
    });

    res.json({
      message: result.message,
      issuer: result.issuer,
      status: 'verified',
      issuerDomain: normalizedDomain,
      keyFingerprint: result.issuer?.publicKeyFingerprint || null
    });
  } else {
    appendTrustEvent(normalizedDomain, {
      action: 'verify_issuer_domain',
      outcome: 'failed',
      source: 'admin_api',
      error: result.error
    });

    res.status(400).json({
      error: result.error,
      details: result.details,
      status: 'failed',
      issuerDomain: normalizedDomain
    });
  }
});

// Public issuer verification endpoint (writes verified issuer on success)
app.post('/public/api/issuers/verify', async (req, res) => {
  const { domain } = req.body || {};

  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  let normalizedDomain;
  try {
    normalizedDomain = normalizeIssuerDomainInput(domain);
  } catch (error) {
    return res.status(400).json({ error: `Invalid domain format: ${error.message}` });
  }

  const existingIssuer = getVerifiedIssuer(normalizedDomain);
  if (existingIssuer && existingIssuer.status === 'verified') {
    appendTrustEvent(normalizedDomain, {
      action: 'verify_issuer_domain',
      outcome: 'cached',
      source: 'public_api',
      keyFingerprint: existingIssuer.publicKeyFingerprint || null
    });

    return res.json({
      message: `Issuer already verified: ${existingIssuer.displayName}`,
      issuer: existingIssuer,
      status: 'verified',
      cached: true,
      issuerDomain: normalizedDomain,
      keyFingerprint: existingIssuer.publicKeyFingerprint || null
    });
  }

  const clientIp = getClientIp(req);
  const rate = publicIssuerVerifyRateLimit(clientIp);
  if (!rate.allowed) {
    res.set('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({
      error: 'Rate limit exceeded for public issuer verification',
      retryAfterSeconds: rate.retryAfterSeconds,
      limits: {
        maxRequests: PUBLIC_ISSUER_VERIFY_MAX_REQUESTS,
        windowMs: PUBLIC_ISSUER_VERIFY_WINDOW_MS
      }
    });
  }

  const cooldown = consumePublicIssuerCooldown(normalizedDomain);
  if (!cooldown.allowed) {
    res.set('Retry-After', String(cooldown.retryAfterSeconds));
    return res.status(429).json({
      error: 'Domain cooldown active for issuer verification writes',
      retryAfterSeconds: cooldown.retryAfterSeconds,
      domain: normalizedDomain
    });
  }

  incrementMetric('trustWriteRequests');

  const result = await verifyIssuerDomain(normalizedDomain, { validateUrl: validatePublicUrl });

  if (result.success) {
    appendTrustEvent(normalizedDomain, {
      action: 'verify_issuer_domain',
      outcome: 'verified',
      source: 'public_api',
      keyFingerprint: result.issuer?.publicKeyFingerprint || null
    });

    return res.json({
      message: result.message,
      issuer: result.issuer,
      status: 'verified',
      issuerDomain: normalizedDomain,
      keyFingerprint: result.issuer?.publicKeyFingerprint || null
    });
  }

  appendTrustEvent(normalizedDomain, {
    action: 'verify_issuer_domain',
    outcome: 'failed',
    source: 'public_api',
    error: result.error
  });

  return res.status(400).json({
    error: result.error,
    details: result.details,
    status: 'failed',
    issuerDomain: normalizedDomain
  });
});

// Get verified issuer info
app.get('/api/issuers/:domain', requireApiKey, async (req, res) => {
  const { domain } = req.params;
  const issuer = getVerifiedIssuer(domain);

  if (!issuer) {
    return res.status(404).json({
      error: 'Issuer not found or not verified',
      domain: domain
    });
  }

  res.json({
    issuer: issuer,
    status: issuer.status
  });
});

// List all verified issuers
app.get('/api/issuers', requireApiKey, async (req, res) => {
  const issuers = loadVerifiedIssuers();
  const issuerList = Object.values(issuers).map(issuer => ({
    domain: issuer.domain,
    displayName: issuer.displayName,
    status: issuer.status,
    lastVerified: issuer.lastVerified,
    type: issuer.type
  }));

  res.json({
    issuers: issuerList,
    count: issuerList.length
  });
});

app.get('/public/api/trust/issuer/:domain', async (req, res) => {
  let normalizedDomain;
  try {
    normalizedDomain = normalizeIssuerDomainInput(req.params.domain);
  } catch (error) {
    return res.status(400).json({ error: `Invalid domain format: ${error.message}` });
  }

  const issuer = getVerifiedIssuer(normalizedDomain);
  if (!issuer) {
    return res.status(404).json({
      domain: normalizedDomain,
      status: 'unverified',
      trustState: TRUST_STATES.UNVERIFIED,
      verificationReason: 'No verified issuer record found for this domain.'
    });
  }

  return res.json({
    domain: normalizedDomain,
    status: issuer.status,
    trustState: issuer.status === 'verified'
      ? TRUST_STATES.DOMAIN_VERIFIED_SIGNATURE
      : TRUST_STATES.UNVERIFIED,
    issuer: {
      domain: issuer.domain,
      displayName: issuer.displayName,
      type: issuer.type,
      url: issuer.url,
      wellKnownUrl: issuer.wellKnownUrl,
      lastVerified: issuer.lastVerified,
      keyFingerprint: issuer.publicKeyFingerprint || null
    }
  });
});

app.get('/public/api/trust/events/:domain', async (req, res) => {
  let normalizedDomain;
  try {
    normalizedDomain = normalizeIssuerDomainInput(req.params.domain);
  } catch (error) {
    return res.status(400).json({ error: `Invalid domain format: ${error.message}` });
  }

  const limit = Math.max(1, Math.min(parsePositiveInt(req.query.limit, 20), 200));
  const events = getTrustEvents(normalizedDomain).slice(0, limit);
  return res.json({
    domain: normalizedDomain,
    count: events.length,
    events
  });
});

app.get('/public/api/trust/issuers', async (req, res) => {
  const issuers = Object.values(loadVerifiedIssuers());
  const requestedStatus = typeof req.query.status === 'string'
    ? req.query.status.trim().toLowerCase()
    : '';

  const filtered = issuers.filter((issuer) => {
    if (!requestedStatus) return true;
    return String(issuer.status || '').toLowerCase() === requestedStatus;
  });

  return res.json({
    count: filtered.length,
    requestedStatus: requestedStatus || null,
    issuers: filtered.map((issuer) => ({
      domain: issuer.domain,
      displayName: issuer.displayName,
      status: issuer.status,
      type: issuer.type,
      wellKnownUrl: issuer.wellKnownUrl,
      lastVerified: issuer.lastVerified,
      keyFingerprint: issuer.publicKeyFingerprint || null
    }))
  });
});

// Re-verify an existing issuer
app.post('/api/issuers/:domain/reverify', requireApiKey, async (req, res) => {
  let normalizedDomain;
  try {
    normalizedDomain = normalizeIssuerDomainInput(req.params.domain);
  } catch (error) {
    return res.status(400).json({ error: `Invalid domain format: ${error.message}` });
  }

  incrementMetric('trustWriteRequests');

  const result = await verifyIssuerDomain(normalizedDomain);

  if (result.success) {
    appendTrustEvent(normalizedDomain, {
      action: 'reverify_issuer_domain',
      outcome: 'verified',
      source: 'admin_api',
      keyFingerprint: result.issuer?.publicKeyFingerprint || null
    });

    res.json({
      message: `Successfully re-verified issuer: ${result.issuer.displayName}`,
      issuer: result.issuer,
      status: 'verified',
      issuerDomain: normalizedDomain,
      keyFingerprint: result.issuer?.publicKeyFingerprint || null
    });
  } else {
    // Mark as failed but keep the record
    const existingIssuer = getVerifiedIssuer(normalizedDomain);
    if (existingIssuer) {
      const failedIssuer = {
        ...existingIssuer,
        status: 'failed',
        lastVerificationAttempt: new Date().toISOString(),
        lastError: result.error
      };
      setVerifiedIssuer(normalizedDomain, failedIssuer);
    }

    appendTrustEvent(normalizedDomain, {
      action: 'reverify_issuer_domain',
      outcome: 'failed',
      source: 'admin_api',
      error: result.error
    });

    res.status(400).json({
      error: result.error,
      details: result.details,
      status: 'failed',
      issuerDomain: normalizedDomain
    });
  }
});

// Badge and Issuer Verification endpoints
async function verifyBadgeByUrlInternal(badgeUrl, options = {}) {
  try {
    console.log(`🔍 Verifying badge: ${badgeUrl}`);

    incrementMetric('externalFetchCount');
    const badgeResponse = await fetch(badgeUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Badge-Generator-Verifier/1.0' }
    });

    if (!badgeResponse.ok) {
      return {
        status: 400,
        body: {
          valid: false,
          error: `Failed to fetch badge: HTTP ${badgeResponse.status}`,
          details: { url: badgeUrl, status: badgeResponse.status },
          ...unverifiedTrustPayload()
        }
      };
    }

    let badgeData;
    try {
      badgeData = await badgeResponse.json();
    } catch (parseError) {
      return {
        status: 400,
        body: {
          valid: false,
          error: `Invalid JSON in badge: ${parseError.message}`,
          details: { url: badgeUrl },
          ...unverifiedTrustPayload()
        }
      };
    }

    return {
      status: 200,
      body: await verifyBadgeDataInternal(badgeData, badgeUrl, options)
    };
  } catch (error) {
    console.error(`Error verifying badge ${badgeUrl}:`, error);
    return {
      status: 500,
      body: {
        valid: false,
        error: `Verification failed: ${error.message}`,
        details: { badgeUrl },
        ...unverifiedTrustPayload()
      }
    };
  }
}

async function verifyBadgeDataInternal(badgeData, badgeUrl = null, { validateUrl } = {}) {
  const isV3 = Array.isArray(badgeData.type) && badgeData.type.includes('OpenBadgeCredential');
  const verificationResults = await verifyBadgeStructure(badgeData, isV3);

  // Extract issuer URL from badge data
  const issuerRef = isV3 ? badgeData.issuer?.id : badgeData.issuer;

  // If a URL validator is provided (public routes), validate before fetching
  if (issuerRef && typeof issuerRef === 'string' && validateUrl) {
    await validateUrl(issuerRef);
  }

  let issuerVerification = null;
  if (isV3 && badgeData.issuer?.id) {
    issuerVerification = await verifyIssuerFromBadge(badgeData.issuer.id);
  } else if (!isV3 && badgeData.issuer) {
    issuerVerification = await verifyIssuerFromBadge(badgeData.issuer);
  }

  let signatureVerification = null;
  if (badgeData.proof && issuerVerification && issuerVerification.valid) {
    signatureVerification = await verifyCryptographicSignature(badgeData, issuerVerification);
  }

  const overallValid = verificationResults.valid &&
    (!issuerVerification || issuerVerification.valid) &&
    (!signatureVerification || signatureVerification.valid);

  const trustPayload = buildTrustPayload({
    structure: verificationResults,
    issuer: issuerVerification,
    signature: signatureVerification
  });

  return {
    valid: overallValid,
    badgeUrl: badgeUrl,
    badgeData: badgeData,
    version: isV3 ? 'v3.0' : 'v2.0',
    structure: verificationResults,
    issuer: issuerVerification,
    signature: signatureVerification,
    verifiedAt: new Date().toISOString(),
    verificationLevel: determineVerificationLevel(verificationResults, issuerVerification, signatureVerification),
    ...trustPayload,
    trustCaveat: 'This verifies domain/key control. It does not certify assessment quality or accreditation.'
  };
}

app.get('/api/verify/badge/:badgeUrl(*)', requireApiKey, async (req, res) => {
  const badgeUrl = req.params.badgeUrl;

  if (!badgeUrl) {
    return res.status(400).json({ error: 'Badge URL is required', ...unverifiedTrustPayload() });
  }

  const result = await verifyBadgeByUrlInternal(badgeUrl);
  res.status(result.status).json(result.body);
});

app.get('/public/api/verify/badge/:badgeUrl(*)', applyPublicVerifyRateLimit, applyPublicVerifyConcurrencyLimit, async (req, res) => {
  incrementMetric('verificationRequests');
  const badgeUrl = req.params.badgeUrl;

  if (!badgeUrl) {
    return res.status(400).json({ error: 'Badge URL is required', ...unverifiedTrustPayload() });
  }

  try {
    await validatePublicUrl(badgeUrl);
  } catch (err) {
    return res.status(400).json({ error: `Blocked: ${err.message}`, ...unverifiedTrustPayload() });
  }

  const result = await verifyBadgeByUrlInternal(badgeUrl, { validateUrl: validatePublicUrl });
  res.status(result.status).json(result.body);
});

app.get('/api/verify/issuer/:issuerUrl(*)', requireApiKey, async (req, res) => {
  const issuerUrl = req.params.issuerUrl;

  if (!issuerUrl) {
    return res.status(400).json({ error: 'Issuer URL is required', ...unverifiedTrustPayload() });
  }

  try {
    console.log(`🔍 Verifying issuer: ${issuerUrl}`);

    const verification = await verifyIssuerFromBadge(issuerUrl);
    const trustPayload = buildIssuerTrustPayload(verification);

    res.json({
      valid: verification.valid,
      issuerUrl: issuerUrl,
      verification: verification,
      verifiedAt: new Date().toISOString(),
      ...trustPayload,
      trustCaveat: 'This verifies domain/key control. It does not certify assessment quality or accreditation.'
    });

  } catch (error) {
    console.error(`Error verifying issuer ${issuerUrl}:`, error);
    res.status(500).json({
      valid: false,
      error: `Verification failed: ${error.message}`,
      details: { issuerUrl },
      ...unverifiedTrustPayload()
    });
  }
});

app.get('/public/api/verify/issuer/:issuerUrl(*)', applyPublicVerifyRateLimit, applyPublicVerifyConcurrencyLimit, async (req, res) => {
  incrementMetric('verificationRequests');
  const issuerUrl = req.params.issuerUrl;

  if (!issuerUrl) {
    return res.status(400).json({ error: 'Issuer URL is required', ...unverifiedTrustPayload() });
  }

  try {
    await validatePublicUrl(issuerUrl);
  } catch (err) {
    return res.status(400).json({ error: `Blocked: ${err.message}`, ...unverifiedTrustPayload() });
  }

  try {
    console.log(`🔍 Verifying issuer: ${issuerUrl}`);

    const verification = await verifyIssuerFromBadge(issuerUrl);
    const trustPayload = buildIssuerTrustPayload(verification);

    res.json({
      valid: verification.valid,
      issuerUrl: issuerUrl,
      verification: verification,
      verifiedAt: new Date().toISOString(),
      ...trustPayload,
      trustCaveat: 'This verifies domain/key control. It does not certify assessment quality or accreditation.'
    });

  } catch (error) {
    console.error(`Error verifying issuer ${issuerUrl}:`, error);
    res.status(500).json({
      valid: false,
      error: `Verification failed: ${error.message}`,
      details: { issuerUrl },
      ...unverifiedTrustPayload()
    });
  }
});

app.post('/public/api/verify/json', applyPublicVerifyRateLimit, applyPublicVerifyConcurrencyLimit, async (req, res) => {
  incrementMetric('verificationRequests');
  const badgeData = req.body?.badgeData || req.body;

  if (!badgeData || typeof badgeData !== 'object' || Array.isArray(badgeData)) {
    return res.status(400).json({ error: 'Badge JSON object is required', ...unverifiedTrustPayload() });
  }

  // SSRF protection: validate any issuer URL embedded in the badge data
  // before verifyBadgeDataInternal follows it via server-side fetch.
  const issuerUrl = (Array.isArray(badgeData.type) && badgeData.type.includes('OpenBadgeCredential'))
    ? badgeData.issuer?.id
    : badgeData.issuer;
  if (issuerUrl && typeof issuerUrl === 'string') {
    try {
      await validatePublicUrl(issuerUrl);
    } catch (err) {
      return res.status(400).json({ error: `Blocked issuer URL: ${err.message}`, ...unverifiedTrustPayload() });
    }
  }

  try {
    const result = await verifyBadgeDataInternal(badgeData, null, { validateUrl: validatePublicUrl });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      valid: false,
      error: `Verification failed: ${error.message}`,
      ...unverifiedTrustPayload()
    });
  }
});

// Helper function to verify badge structure
async function verifyBadgeStructure(badgeData, isV3) {
  const errors = [];
  const warnings = [];

  // Check required fields based on version
  if (isV3) {
    // Open Badges v3.0 validation
    if (!badgeData['@context'] || !Array.isArray(badgeData['@context'])) {
      errors.push('Missing or invalid @context');
    }
    if (!badgeData.type || !Array.isArray(badgeData.type) || !badgeData.type.includes('OpenBadgeCredential')) {
      errors.push('Invalid type - must include OpenBadgeCredential');
    }
    if (!badgeData.issuer?.id) {
      errors.push('Missing issuer.id');
    }
    if (!badgeData.credentialSubject?.achievement?.id) {
      errors.push('Missing credentialSubject.achievement.id');
    }
    if (!badgeData.validFrom) {
      warnings.push('Missing validFrom date');
    }
  } else {
    // Open Badges v2.0 validation
    if (!badgeData['@context']) {
      errors.push('Missing @context');
    }
    if (badgeData.type !== 'Assertion') {
      errors.push('Invalid type - must be Assertion');
    }
    if (!badgeData.badge) {
      errors.push('Missing badge reference');
    }
    if (!badgeData.recipient) {
      errors.push('Missing recipient information');
    }
    if (!badgeData.issuedOn) {
      warnings.push('Missing issuedOn date');
    }
  }

  // URL validation
  if (badgeData.id && !isValidUrl(badgeData.id)) {
    errors.push('Invalid badge ID URL');
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    fields_checked: isV3 ? ['@context', 'type', 'issuer.id', 'credentialSubject'] : ['@context', 'type', 'badge', 'recipient'],
    version: isV3 ? 'v3.0' : 'v2.0'
  };
}

// Helper function to verify issuer from badge
async function verifyIssuerFromBadge(issuerUrl) {
  try {
    // First check if we have this issuer verified locally
    const urlObj = new URL(issuerUrl);
    const domainHost = urlObj.host.toLowerCase();
    const domainName = urlObj.hostname.toLowerCase();
    const validationLabel = getValidationLabelForDomain(domainHost);
    if (validationLabel === DEMO_VALIDATION_LABEL) {
      const demoIssuer = buildDemoIssuerProfile(issuerUrl);
      const demoKeyPem = toPublicKeyPem(demoIssuer.publicKey) || demoIssuer.publicKeyPem || null;
      return {
        valid: true,
        type: 'demo_profile',
        issuer: {
          ...demoIssuer,
          wellKnownUrl: issuerUrl
        },
        issuerDomain: domainHost,
        keyFingerprint: computeKeyFingerprint(demoKeyPem),
        issuerClaimedName: demoIssuer.name || null,
        validationLabel,
        message: `Demo issuer resolved locally for ${domainHost}`
      };
    }
    const localIssuer = getVerifiedIssuer(domainHost) || getVerifiedIssuer(domainName);
    const domain = localIssuer?.domain || domainHost;

    if (localIssuer && localIssuer.status === 'verified') {
      return {
        valid: true,
        type: 'locally_verified',
        issuer: localIssuer,
        issuerDomain: localIssuer.domain || domain,
        keyFingerprint: localIssuer.publicKeyFingerprint || null,
        issuerClaimedName: localIssuer.displayName || null,
        validationLabel: getValidationLabelForDomain(localIssuer.domain || domain),
        message: `Issuer verified locally: ${localIssuer.displayName}`
      };
    }

    // Try to fetch issuer data directly
    incrementMetric('externalFetchCount');
    const issuerResponse = await fetch(issuerUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Badge-Generator-Verifier/1.0' }
    });

    if (!issuerResponse.ok) {
      return {
        valid: false,
        error: `Failed to fetch issuer: HTTP ${issuerResponse.status}`,
        details: { url: issuerUrl, status: issuerResponse.status }
      };
    }

    let issuerData;
    try {
      issuerData = await issuerResponse.json();
    } catch (parseError) {
      return {
        valid: false,
        error: `Invalid JSON in issuer: ${parseError.message}`,
        details: { url: issuerUrl }
      };
    }

    // Validate issuer structure
    const isV3Issuer = issuerData.type === 'Profile';
    const requiredFields = isV3Issuer ? ['id', 'type', 'name'] : ['@context', 'type', 'name', 'url'];
    const missingFields = requiredFields.filter(field => !issuerData[field]);

    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        details: { url: issuerUrl, missingFields },
        issuerDomain: domain
      };
    }

    // Check if issuer ID matches the URL (with some flexibility)
    const isIdMatching = issuerData.id === issuerUrl ||
      issuerData.originalId === issuerUrl ||
      issuerData.id === issuerData.originalId;

    if (!isIdMatching) {
      // Allow some common URL variations
      const normalizedIssuerUrl = issuerUrl.replace(/\/$/, ''); // Remove trailing slash
      const normalizedIssuerId = issuerData.id.replace(/\/$/, '');

      if (normalizedIssuerId !== normalizedIssuerUrl) {
        console.warn(`Issuer ID mismatch: ID='${issuerData.id}', URL='${issuerUrl}'`);
        // Don't fail verification for ID mismatch, just warn
        // This allows for more flexible badge verification
      }
    }

    const publicKeyPem = toPublicKeyPem(issuerData.publicKey) ||
      (Array.isArray(issuerData.publicKeys) ? toPublicKeyPem(issuerData.publicKeys[0]) : null);

    return {
      valid: true,
      type: 'remote_verified',
      issuer: issuerData,
      issuerDomain: domain,
      issuerClaimedName: issuerData.name || null,
      keyFingerprint: computeKeyFingerprint(publicKeyPem),
      validationLabel: getValidationLabelForDomain(domain),
      message: `Issuer verified from remote URL: ${issuerData.name}`
    };

  } catch (error) {
    return {
      valid: false,
      error: `Issuer verification failed: ${error.message}`,
      details: { url: issuerUrl },
      issuerDomain: normalizeDomainOrHost(issuerUrl),
      validationLabel: getValidationLabelForDomain(issuerUrl)
    };
  }
}

// Helper function to determine verification level
function determineVerificationLevel(structureVerification, issuerVerification, signatureVerification) {
  if (!structureVerification.valid) {
    return 'invalid';
  }

  if (!issuerVerification) {
    return 'structure_only';
  }

  if (!issuerVerification.valid) {
    return 'structure_valid_issuer_invalid';
  }

  if (signatureVerification && signatureVerification.valid) {
    return 'cryptographically_verified';
  }

  if (issuerVerification.type === 'locally_verified') {
    return 'fully_verified';
  }

  if (issuerVerification.type === 'remote_verified') {
    return 'remote_verified';
  }

  return 'basic_verified';
}

// Helper function to validate URLs
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Cryptographic signature verification functions
function signBadgeData(badgeData, privateKeyPem) {
  try {
    // Create a canonical string representation for signing
    const canonicalData = JSON.stringify(badgeData, null, 0);
    const dataBuffer = Buffer.from(canonicalData, 'utf8');

    // Create private key object
    const privateKey = crypto.createPrivateKey(privateKeyPem);

    // Sign the data
    const signature = crypto.sign(null, dataBuffer, privateKey);

    // Convert to base64url for JSON-LD
    return signature.toString('base64url');
  } catch (error) {
    throw new Error(`Failed to sign badge data: ${error.message}`);
  }
}

function verifyBadgeSignature(badgeData, signature, publicKeyPem) {
  try {
    // Remove proof from badge data for verification
    const dataToVerify = { ...badgeData };
    delete dataToVerify.proof;

    // Create canonical string representation
    const canonicalData = JSON.stringify(dataToVerify, null, 0);
    const dataBuffer = Buffer.from(canonicalData, 'utf8');

    // Create public key object
    const publicKey = crypto.createPublicKey(publicKeyPem);

    // Convert signature from base64url
    const signatureBuffer = Buffer.from(signature, 'base64url');

    // Verify the signature
    return crypto.verify(null, dataBuffer, publicKey, signatureBuffer);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

async function getBadgeSigningKey(domain) {
  const requestedDomain = normalizePublicDomain(domain);

  if (isExampleDemoDomain(requestedDomain.host) || isExampleDemoDomain(requestedDomain.hostname)) {
    const demoPrivateKey = loadDemoPrivateKeyPem();
    if (demoPrivateKey) {
      console.log('Using example.com demo private key for badge signing');
      return demoPrivateKey;
    }
    console.error('No demo signing key configured. Set DEMO_EXAMPLE_PRIVATE_KEY or add demo-keys/example.com-private-key.pem');
    return null;
  }

  // Only support our own domain for non-demo signing
  const ourDomain = normalizePublicDomain(process.env.PUBLIC_DOMAIN || 'localhost:3000');

  if (requestedDomain.host !== ourDomain.host && requestedDomain.hostname !== ourDomain.hostname) {
    console.warn(`Refusing to sign for external domain: ${domain}. We only sign for our domain: ${ourDomain.host}`);
    return null;
  }

  // Use the default (our) private key from environment
  if (process.env.DEFAULT_PRIVATE_KEY) {
    console.log('Using default private key for badge signing');
    return process.env.DEFAULT_PRIVATE_KEY;
  }

  // Local development: try to find our signing key in files
  if (process.env.NODE_ENV !== 'production') {
    const keyPaths = [
      path.join('issuer-verification-files', 'private-key.pem'),
      uploadsPath('default-private-key.pem')
    ];

    for (const keyPath of keyPaths) {
      if (fs.existsSync(keyPath)) {
        try {
          console.log(`Using private key from file: ${keyPath} (development only)`);
          return fs.readFileSync(keyPath, 'utf8');
        } catch (error) {
          console.warn(`Failed to read key from ${keyPath}:`, error.message);
        }
      }
    }
  }

  console.error(`No private key configured. Set DEFAULT_PRIVATE_KEY environment variable.`);
  return null;
}

async function getBadgeVerificationKey(issuerData, issuerUrl) {
  // Try to get public key from issuer data first (most reliable)
  let resolvedFromIssuer = toPublicKeyPem(issuerData.publicKey);
  if (!resolvedFromIssuer && Array.isArray(issuerData.publicKeys) && issuerData.publicKeys.length > 0) {
    resolvedFromIssuer = toPublicKeyPem(issuerData.publicKeys[0]);
  }
  if (resolvedFromIssuer) {
    await cachePublicKey(issuerUrl, resolvedFromIssuer);
    return {
      publicKeyPem: resolvedFromIssuer,
      source: 'issuer_profile',
      keyFingerprint: computeKeyFingerprint(resolvedFromIssuer)
    };
  }

  // Check cached public keys in uploads volume
  const urlObj = new URL(issuerUrl);
  const domain = urlObj.hostname.toLowerCase();
  const issuerHost = urlObj.host.toLowerCase();
  const cachedKeyPath = uploadsPath('cached-public-keys', `${domain}.pem`);

  if (fs.existsSync(cachedKeyPath)) {
    try {
      console.log(`Using cached public key for domain: ${domain}`);
      incrementMetric('keyCacheHits');
      const cachedKey = fs.readFileSync(cachedKeyPath, 'utf8');
      return {
        publicKeyPem: cachedKey,
        source: 'cache',
        keyFingerprint: computeKeyFingerprint(cachedKey)
      };
    } catch (error) {
      console.warn(`Failed to read cached key for ${domain}:`, error.message);
    }
  }
  incrementMetric('keyCacheMisses');

  // Fallback to our default public key (for our own domain)
  const ourDomain = normalizePublicDomain(process.env.PUBLIC_DOMAIN || 'localhost:3000');
  if (process.env.DEFAULT_PUBLIC_KEY && (issuerHost === ourDomain.host || domain === ourDomain.hostname)) {
    console.log('Using default public key from environment');
    return {
      publicKeyPem: process.env.DEFAULT_PUBLIC_KEY,
      source: 'env_default',
      keyFingerprint: computeKeyFingerprint(process.env.DEFAULT_PUBLIC_KEY)
    };
  }

  // Local development: try to find public key files
  if (process.env.NODE_ENV !== 'production') {
    const keyPaths = [
      path.join('issuer-verification-files', 'public-key.pem'),
      uploadsPath('default-public-key.pem')
    ];

    for (const keyPath of keyPaths) {
      if (fs.existsSync(keyPath)) {
        try {
          console.log(`Using public key from file: ${keyPath} (development only)`);
          const fileKey = fs.readFileSync(keyPath, 'utf8');
          return {
            publicKeyPem: fileKey,
            source: 'dev_file',
            keyFingerprint: computeKeyFingerprint(fileKey)
          };
        } catch (error) {
          console.warn(`Failed to read public key from ${keyPath}:`, error.message);
        }
      }
    }
  }

  console.warn(`No public key found for domain: ${domain}`);
  return null;
}

// Helper function to cache public keys to the uploads volume
async function cachePublicKey(issuerUrl, publicKey) {
  try {
    const urlObj = new URL(issuerUrl);
    const domain = urlObj.hostname;
    const cacheDir = uploadsPath('cached-public-keys');
    const cachedKeyPath = path.join(cacheDir, `${domain}.pem`);

    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Cache the public key
    fs.writeFileSync(cachedKeyPath, publicKey);
    console.log(`Cached public key for domain: ${domain}`);
  } catch (error) {
    console.warn(`Failed to cache public key for ${issuerUrl}:`, error.message);
  }
}

async function verifyCryptographicSignature(badgeData, issuerVerification) {
  try {
    // Check if badge has a proof/signature
    if (!badgeData.proof) {
      return {
        valid: false,
        type: 'no_signature',
        message: 'Badge has no cryptographic proof/signature'
      };
    }

    // Extract signature from proof
    let signature = null;
    if (typeof badgeData.proof === 'string') {
      signature = badgeData.proof;
    } else if (badgeData.proof.jws) {
      signature = badgeData.proof.jws;
    } else if (badgeData.proof.proofValue) {
      signature = badgeData.proof.proofValue;
    }

    if (!signature) {
      return {
        valid: false,
        type: 'invalid_proof_format',
        message: 'Unable to extract signature from proof'
      };
    }

    // Get the issuer's public key
    const issuerUrl = issuerVerification.issuer.id || issuerVerification.issuer.url;
    const issuerDomain = normalizeDomainOrHost(issuerUrl);
    const verificationMethod = badgeData.proof.verificationMethod || null;
    const verificationMethodDomain = normalizeDomainOrHost(verificationMethod);
    const domainBound = Boolean(
      issuerDomain &&
      verificationMethodDomain &&
      (issuerDomain === verificationMethodDomain ||
        issuerDomain.split(':')[0] === verificationMethodDomain.split(':')[0])
    );

    const verificationKey = await getBadgeVerificationKey(issuerVerification.issuer, issuerUrl);

    if (!verificationKey?.publicKeyPem) {
      return {
        valid: false,
        type: 'no_public_key',
        message: 'No public key found for issuer',
        issuerDomain,
        verificationMethodDomain,
        domainBound,
        keyDiscoverable: false
      };
    }

    // Verify the signature
    const isValidSignature = verifyBadgeSignature(badgeData, signature, verificationKey.publicKeyPem);

    if (isValidSignature) {
      return {
        valid: true,
        type: 'signature_verified',
        message: 'Cryptographic signature is valid',
        signatureType: badgeData.proof.type || 'Ed25519Signature2020',
        verificationMethod: verificationMethod || 'unknown',
        verificationMethodDomain,
        issuerDomain,
        domainBound,
        keyDiscoverable: true,
        keySource: verificationKey.source,
        keyFingerprint: verificationKey.keyFingerprint || null
      };
    } else {
      return {
        valid: false,
        type: 'signature_invalid',
        message: 'Cryptographic signature verification failed',
        verificationMethod: verificationMethod || 'unknown',
        verificationMethodDomain,
        issuerDomain,
        domainBound,
        keyDiscoverable: true,
        keySource: verificationKey.source,
        keyFingerprint: verificationKey.keyFingerprint || null
      };
    }

  } catch (error) {
    return {
      valid: false,
      type: 'verification_error',
      error: error.message,
      message: 'Error during signature verification',
      keyDiscoverable: false
    };
  }
}

// Public key caching endpoint
app.post('/api/cache-public-key', requireApiKey, async (req, res) => {
  const { issuerUrl } = req.body;

  if (!issuerUrl) {
    return res.status(400).json({ error: 'Issuer URL is required' });
  }

  try {
    console.log(`🔍 Fetching and caching public key for: ${issuerUrl}`);

    // Fetch the issuer data
    incrementMetric('externalFetchCount');
    const issuerResponse = await fetch(issuerUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Badge-Generator-KeyCache/1.0' }
    });

    if (!issuerResponse.ok) {
      return res.status(400).json({
        error: `Failed to fetch issuer: HTTP ${issuerResponse.status}`,
        details: { url: issuerUrl, status: issuerResponse.status }
      });
    }

    let issuerData;
    try {
      issuerData = await issuerResponse.json();
    } catch (parseError) {
      return res.status(400).json({
        error: `Invalid JSON in issuer: ${parseError.message}`,
        details: { url: issuerUrl }
      });
    }

    // Extract and cache the public key
    const keyMaterial = await getBadgeVerificationKey(issuerData, issuerUrl);

    if (!keyMaterial?.publicKeyPem) {
      return res.status(400).json({
        error: 'No public key found in issuer data',
        details: { url: issuerUrl }
      });
    }

    res.json({
      message: 'Public key cached successfully',
      issuerUrl: issuerUrl,
      issuerName: issuerData.name,
      domain: new URL(issuerUrl).hostname,
      keyType: 'PEM',
      keyFingerprint: keyMaterial.keyFingerprint || null,
      keySource: keyMaterial.source,
      cached: true
    });

  } catch (error) {
    console.error(`Error caching public key for ${issuerUrl}:`, error);
    res.status(500).json({
      error: `Failed to cache public key: ${error.message}`,
      details: { issuerUrl }
    });
  }
});

// Badge signing endpoint
app.post('/api/sign-badge', requireApiKey, async (req, res) => {
  const { badgeData } = req.body;
  let { domain } = req.body;

  if (!badgeData || !domain) {
    return res.status(400).json({ error: 'Badge data and domain are required' });
  }

  // Strip any scheme prefix to prevent malformed URLs like https://https://...
  domain = domain.replace(/^[a-z]+:\/\//i, '').replace(/\/+$/, '');
  if (domain.includes('/')) {
    return res.status(400).json({ error: 'Domain must be a bare host (e.g. example.com or example.com:3000), not a URL' });
  }

  try {
    // Get the signing key for the domain
    const privateKey = await getBadgeSigningKey(domain);
    if (!privateKey) {
      return res.status(400).json({
        error: `No signing key found for domain: ${domain}`,
        suggestion: 'Use the CLI tool to generate verification files: badge-cli generate-keys'
      });
    }

    // Sign the badge data
    const signature = signBadgeData(badgeData, privateKey);

    // Add proof to badge data
    const signedBadge = {
      ...badgeData,
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        verificationMethod: `https://${domain}${WELL_KNOWN_ISSUER_PATH}#key`,
        proofPurpose: 'assertionMethod',
        jws: signature
      }
    };

    res.json({
      message: 'Badge signed successfully',
      signedBadge: signedBadge,
      signature: signature,
      verificationMethod: `https://${domain}${WELL_KNOWN_ISSUER_PATH}#key`
    });

  } catch (error) {
    console.error(`Error signing badge:`, error);
    res.status(500).json({
      error: `Failed to sign badge: ${error.message}`
    });
  }
});

function resolvePublicBaseUrl(req) {
  const configured = normalizePublicDomain(process.env.PUBLIC_DOMAIN || '');
  const configuredLooksValid = configured && configured.host && configured.hostname && configured.hostname !== 'localhost';
  if (configuredLooksValid) {
    return `https://${configured.host}`;
  }
  return `${req.protocol}://${req.get('host')}`;
}

function toSafeSlug(value, fallback = 'demo') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

app.post('/public/api/demo/prompt-to-badge', applyPublicVerifyConcurrencyLimit, async (req, res) => {
  const clientIp = getClientIp(req);
  const rate = publicPromptBadgeRateLimit(clientIp);
  if (!rate.allowed) {
    res.set('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({
      error: 'Rate limit exceeded for prompt-to-badge demo requests',
      retryAfterSeconds: rate.retryAfterSeconds,
      limits: {
        maxRequests: PUBLIC_PROMPT_BADGE_MAX_REQUESTS,
        windowMs: PUBLIC_PROMPT_BADGE_WINDOW_MS
      }
    });
  }

  const {
    learnerName,
    sourceUrl,
    summary,
    proficiency,
    skills,
    badgeName
  } = req.body || {};

  if (!summary || String(summary).trim().length < 12) {
    return res.status(400).json({
      error: 'assessment summary is required (min 12 characters)'
    });
  }

  if (sourceUrl && typeof sourceUrl === 'string') {
    try {
      // For demo metadata we only validate URL shape; we do not fetch sourceUrl.
      new URL(sourceUrl);
    } catch {
      return res.status(400).json({ error: 'sourceUrl must be a valid URL' });
    }
  }

  const normalizedSkills = Array.isArray(skills)
    ? skills.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 10)
    : [];
  const skillList = normalizedSkills.length > 0 ? normalizedSkills : ['critical reading'];
  const proficiencyLabel = ['beginner', 'intermediate', 'advanced', 'expert'].includes(String(proficiency || '').toLowerCase())
    ? String(proficiency).toLowerCase()
    : 'self-reported';

  const baseUrl = resolvePublicBaseUrl(req);
  const issuerDomain = DEMO_DOMAIN_SUFFIX;
  const issuerUrl = `https://${issuerDomain}${WELL_KNOWN_ISSUER_PATH}`;
  const issuerProfile = buildDemoIssuerProfile(issuerUrl);
  const privateKey = await getBadgeSigningKey(issuerDomain);
  if (!privateKey) {
    return res.status(503).json({
      error: 'Demo signing key is not configured on this server'
    });
  }

  const nowIso = new Date().toISOString();
  const learnerSlug = toSafeSlug(learnerName, 'learner');
  const badgeSlug = toSafeSlug(badgeName || skillList[0] || 'prompt-badge', 'prompt-badge');
  const filename = `demo-prompt-badge-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.json`;
  const badgeUrl = `${baseUrl}/badges/${filename}`;

  const unsignedBadge = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'
    ],
    id: badgeUrl,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: {
      id: issuerProfile.id,
      type: ['Profile'],
      name: issuerProfile.name,
      url: issuerProfile.url
    },
    validFrom: nowIso,
    name: badgeName || `Skill Badge: ${skillList[0]}`,
    description: 'Demo credential generated through the prompt-to-badge flow.',
    credentialSubject: {
      id: `did:example:${learnerSlug}-${Date.now()}`,
      type: ['AchievementSubject'],
      achievement: {
        id: `${baseUrl}/samples/demo-achievement.json#${badgeSlug}`,
        type: ['Achievement'],
        name: badgeName || `Applied ${skillList[0]} comprehension`,
        description: `Issued for demonstrated understanding based on self-assessment summary.`,
        criteria: {
          narrative: 'Learner submitted a structured summary and self-assessment.'
        },
        tags: skillList
      },
      narrative: String(summary).trim(),
      extensions: {
        assessment_mode: 'self',
        assessment_summary: String(summary).trim(),
        proficiency: proficiencyLabel,
        source_url: sourceUrl || null,
        generated_by: 'prompt-to-badge-demo'
      }
    }
  };

  const signature = signBadgeData(unsignedBadge, privateKey);
  const signedBadge = {
    ...unsignedBadge,
    proof: {
      type: 'Ed25519Signature2020',
      created: nowIso,
      verificationMethod: `${issuerUrl}#key`,
      proofPurpose: 'assertionMethod',
      jws: signature
    }
  };

  ensureUploadsDir();
  fs.writeFileSync(uploadsPath(filename), JSON.stringify(signedBadge, null, 2));

  incrementMetric('promptBadgeRequests');
  appendTrustEvent(issuerDomain, {
    action: 'issue_prompt_demo_badge',
    outcome: 'issued',
    source: 'public_demo'
  });

  const verifyUrl = `${baseUrl}/verify.html?url=${encodeURIComponent(badgeUrl)}&autoverify=1`;
  const shareText = `I generated a signed Open Badge in under two minutes. Verify it yourself: ${verifyUrl}`;

  return res.json({
    message: 'Prompt-to-badge demo credential generated',
    validationLabel: DEMO_VALIDATION_LABEL,
    issuerDomain,
    badgeUrl,
    verifyUrl,
    shareText,
    trustHint: 'Expected trust state: DEMO_DOMAIN_VERIFIED_SIGNATURE',
    signedBadge
  });
});

// API endpoints for creating issuers and badge classes
app.post('/api/issuer', requireApiKey, async (req, res) => {
  const { id, name, url, email, description, image } = req.body;

  if (!id || !name || !url) {
    return res.status(400).json({ error: 'Missing required fields: id, name, url' });
  }

  // Validate the issuer domain
  const domainValidation = await validateIssuerDomain(id);
  if (!domainValidation.valid) {
    return res.status(400).json({
      error: domainValidation.message,
      domain_validation: domainValidation
    });
  }

  const filename = `issuer-${Date.now()}.json`;
  const filepath = uploadsPath(filename);
  const actualUrl = `${req.protocol}://${req.get('host')}/badges/${filename}`;

  const issuer = {
    "@context": "https://w3id.org/openbadges/v2",
    "type": "Issuer",
    "id": actualUrl, // Use the actual hosted URL as the ID
    "name": name,
    "url": url,
    "email": email,
    "description": description,
    "image": image,
    "originalId": id // Keep track of the original requested ID
  };

  // Remove undefined fields
  Object.keys(issuer).forEach(key => issuer[key] === undefined && delete issuer[key]);

  ensureUploadsDir();
  fs.writeFileSync(filepath, JSON.stringify(issuer, null, 2));

  res.json({
    message: 'Issuer created successfully',
    filename: filename,
    url: `${req.protocol}://${req.get('host')}/badges/${filename}`,
    issuer: issuer,
    warnings: domainValidation.warnings,
    domain_info: {
      type: domainValidation.type,
      message: domainValidation.message,
      is_production_ready: domainValidation.type === 'verified'
    }
  });
});

app.post('/api/badge-class', requireApiKey, async (req, res) => {
  const { id, name, description, image, criteria, issuer, tags } = req.body;

  if (!id || !name || !description || !criteria || !issuer) {
    return res.status(400).json({ error: 'Missing required fields: id, name, description, criteria, issuer' });
  }

  // Validate both the badge class ID and issuer domains
  const badgeValidation = await validateIssuerDomain(id);
  const issuerValidation = await validateIssuerDomain(issuer);

  if (!badgeValidation.valid) {
    return res.status(400).json({
      error: `Badge class domain validation failed: ${badgeValidation.message}`,
      domain_validation: badgeValidation
    });
  }

  if (!issuerValidation.valid) {
    return res.status(400).json({
      error: `Issuer domain validation failed: ${issuerValidation.message}`,
      domain_validation: issuerValidation
    });
  }

  const filename = `badge-class-${Date.now()}.json`;
  const filepath = uploadsPath(filename);
  const actualUrl = `${req.protocol}://${req.get('host')}/badges/${filename}`;

  const badgeClass = {
    "@context": "https://w3id.org/openbadges/v2",
    "type": "BadgeClass",
    "id": actualUrl, // Use the actual hosted URL as the ID
    "name": name,
    "description": description,
    "image": image,
    "criteria": criteria,
    "issuer": issuer,
    "tags": tags,
    "originalId": id // Keep track of the original requested ID
  };

  // Remove undefined fields
  Object.keys(badgeClass).forEach(key => badgeClass[key] === undefined && delete badgeClass[key]);

  ensureUploadsDir();
  fs.writeFileSync(filepath, JSON.stringify(badgeClass, null, 2));

  const allWarnings = [...badgeValidation.warnings, ...issuerValidation.warnings];

  res.json({
    message: 'Badge class created successfully',
    filename: filename,
    url: `${req.protocol}://${req.get('host')}/badges/${filename}`,
    badgeClass: badgeClass,
    warnings: allWarnings,
    domain_info: {
      badge_domain: {
        type: badgeValidation.type,
        message: badgeValidation.message
      },
      issuer_domain: {
        type: issuerValidation.type,
        message: issuerValidation.message
      },
      is_production_ready: badgeValidation.type === 'verified' && issuerValidation.type === 'verified'
    }
  });
});

// API endpoint to create credential subject (badge assertion)
app.post('/api/credential-subject', requireApiKey, async (req, res) => {
  const { id, recipient, badge, issuedOn, expires, evidence } = req.body;

  if (!id || !recipient || !badge) {
    return res.status(400).json({ error: 'Missing required fields: id, recipient, badge' });
  }

  // Validate credential and badge domains
  const credentialValidation = await validateIssuerDomain(id);
  const badgeValidation = await validateIssuerDomain(badge);

  if (!credentialValidation.valid) {
    return res.status(400).json({
      error: `Credential domain validation failed: ${credentialValidation.message}`,
      domain_validation: credentialValidation
    });
  }

  if (!badgeValidation.valid) {
    return res.status(400).json({
      error: `Badge domain validation failed: ${badgeValidation.message}`,
      domain_validation: badgeValidation
    });
  }

  const filename = `credential-${Date.now()}.json`;
  const filepath = uploadsPath(filename);
  const actualUrl = `${req.protocol}://${req.get('host')}/badges/${filename}`;

  const credentialSubject = {
    "@context": "https://w3id.org/openbadges/v2",
    "type": "Assertion",
    "id": actualUrl, // Use the actual hosted URL as the ID
    "recipient": recipient,
    "badge": badge,
    "issuedOn": issuedOn || new Date().toISOString(),
    "expires": expires,
    "evidence": evidence,
    "originalId": id // Keep track of the original requested ID
  };

  // Remove undefined fields
  Object.keys(credentialSubject).forEach(key => credentialSubject[key] === undefined && delete credentialSubject[key]);

  ensureUploadsDir();
  fs.writeFileSync(filepath, JSON.stringify(credentialSubject, null, 2));

  const allWarnings = [...credentialValidation.warnings, ...badgeValidation.warnings];

  res.json({
    message: 'Credential subject created successfully',
    filename: filename,
    url: `${req.protocol}://${req.get('host')}/badges/${filename}`,
    credentialSubject: credentialSubject,
    warnings: allWarnings,
    domain_info: {
      credential_domain: {
        type: credentialValidation.type,
        message: credentialValidation.message
      },
      badge_domain: {
        type: badgeValidation.type,
        message: badgeValidation.message
      },
      is_production_ready: credentialValidation.type === 'verified' && badgeValidation.type === 'verified'
    }
  });
});

let server = null;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Badge Generator server running on port ${PORT}`);
    console.log(`API documentation: https://github.com/mohit/badge-generator`);
    console.log(`API key: ${process.env.API_KEY ? '***configured***' : 'NOT SET'}`);
    console.log(`Uploads directory: ${UPLOADS_DIR}`);
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed. Process terminating.');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed. Process terminating.');
      process.exit(0);
    });
  });
}
