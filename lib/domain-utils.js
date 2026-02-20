export function normalizePublicDomain(publicDomain = 'localhost:3000') {
  let raw = (publicDomain || 'localhost:3000').trim();
  if (!raw) {
    raw = 'localhost:3000';
  }

  const withScheme = raw.includes('://') ? raw : `https://${raw}`;

  try {
    const parsed = new URL(withScheme);
    return {
      original: raw,
      host: parsed.host.toLowerCase(),
      hostname: parsed.hostname.toLowerCase()
    };
  } catch {
    const sanitized = raw.replace(/^[a-z]+:\/\//i, '').split('/')[0].toLowerCase();
    const hostname = sanitized.split(':')[0] || sanitized;
    return {
      original: raw,
      host: sanitized,
      hostname
    };
  }
}

export function normalizeUrlParts(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.host.toLowerCase(),
      hostname: parsed.hostname.toLowerCase()
    };
  } catch {
    return null;
  }
}

export function matchesPublicDomain(url, publicDomainConfig) {
  const urlParts = normalizeUrlParts(url);
  if (!urlParts) {
    return false;
  }

  return (
    urlParts.host === publicDomainConfig.host ||
    urlParts.hostname === publicDomainConfig.hostname
  );
}

