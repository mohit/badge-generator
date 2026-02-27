document.addEventListener('DOMContentLoaded', () => {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16, rootMargin: '0px 0px -24px 0px' }
  );

  document.querySelectorAll('.scroll-animate').forEach((element) => {
    revealObserver.observe(element);
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      let target = null;
      try {
        target = document.querySelector(href);
      } catch {
        return;
      }
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const liveDemoCredentialUrl = 'https://badges.firmament.works/samples/demo-openbadge-v3-signed.json';

  function escapeHtml(input) {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeHttpUrl(candidate, fallback = '#') {
    try {
      const parsed = new URL(String(candidate || ''));
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  function isDemoDomain(domain) {
    if (!domain) return false;
    try {
      const parsed = new URL(String(domain).includes('://') ? domain : `https://${domain}`);
      const hostname = parsed.hostname.toLowerCase();
      return hostname === 'example.com' || hostname.endsWith('.example.com');
    } catch {
      return false;
    }
  }

  const statusClassMap = {
    pass: 'status-pass',
    warn: 'status-warn',
    fail: 'status-fail',
    skip: 'status-skip'
  };

  const statusTextMap = {
    pass: 'pass',
    warn: 'warn',
    fail: 'fail',
    skip: 'skip'
  };

  function statusPill(state, text) {
    const css = statusClassMap[state] || 'status-skip';
    const label = escapeHtml(text || statusTextMap[state] || 'skip');
    return `<span class="status-pill ${css}">${label}</span>`;
  }

  function ladderRow(label, state, text) {
    return `<div class="result-ladder-row"><span class="label">${escapeHtml(label)}</span>${statusPill(state, text)}</div>`;
  }

  document.querySelectorAll('[data-demo-url-link]').forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    link.href = `/verify.html?url=${encodeURIComponent(liveDemoCredentialUrl)}&autoverify=1`;
  });

  const menuButton = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');

  if (menuButton && navLinks) {
    menuButton.addEventListener('click', () => {
      const active = navLinks.classList.toggle('active');
      menuButton.setAttribute('aria-expanded', String(active));
      menuButton.textContent = active ? 'Close' : 'Menu';
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.textContent = 'Menu';
      });
    });

    document.addEventListener('click', (event) => {
      if (!navLinks.classList.contains('active')) return;
      if (event.target === menuButton || menuButton.contains(event.target)) return;
      if (navLinks.contains(event.target)) return;

      navLinks.classList.remove('active');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.textContent = 'Menu';
    });
  }

  document.querySelectorAll('.copy-btn[data-copy-target]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-copy-target');
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;

      const text = target.textContent || '';
      let copied = false;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch {
        copied = false;
      }

      if (!copied) {
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        try {
          copied = document.execCommand('copy');
        } catch {
          copied = false;
        }
        selection?.removeAllRanges();
      }

      const original = button.textContent;
      button.textContent = copied ? 'Copied' : 'Copy failed';
      button.setAttribute('data-copied', copied ? 'true' : 'false');
      window.setTimeout(() => {
        button.textContent = original || 'Copy';
        button.setAttribute('data-copied', 'false');
      }, 1400);
    });
  });

  const challengeStartButton = document.querySelector('[data-challenge-start]');
  const challengeResultCard = document.getElementById('challenge-result-card');
  const challengeShareLink = document.getElementById('challenge-share-link');
  const challengeShareText = document.getElementById('challenge-share-text');
  const challengeShareX = document.getElementById('challenge-share-x');
  const challengeShareLinkedIn = document.getElementById('challenge-share-linkedin');
  const challengeShareMastodon = document.getElementById('challenge-share-mastodon');

  async function runChallengeVerification() {
    if (!challengeResultCard) return;
    challengeResultCard.style.display = 'block';
    challengeResultCard.innerHTML = '<p class="small-note">Running verification...</p>';

    try {
      const response = await fetch(`/public/api/verify/badge/${encodeURIComponent(liveDemoCredentialUrl)}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      const trustState = result.trustState || 'UNVERIFIED';
      const badgeClass = trustState === 'DOMAIN_VERIFIED_SIGNATURE'
        ? 'trust-badge trust-badge--verified'
        : trustState === 'DEMO_DOMAIN_VERIFIED_SIGNATURE'
          ? 'trust-badge trust-badge--demo'
          : 'trust-badge trust-badge--unverified';
      const domain = result.issuerDomain || 'unknown';
      const validationLabel = result.validationLabel || (isDemoDomain(domain) ? 'DEMO' : null);
      const claimedName = result.issuerClaimedName || 'not provided';
      const fingerprint = result.keyFingerprint || 'not available';
      const reason = result.verificationReason || 'Issuer cannot be cryptographically verified.';
      const structureState = result.structure ? (result.structure.valid ? 'pass' : 'fail') : 'skip';
      const issuerState = result.issuer ? (result.issuer.valid ? 'pass' : 'fail') : 'skip';
      const signatureState = result.signature ? (result.signature.valid ? 'pass' : 'fail') : 'skip';

      challengeResultCard.innerHTML = `
        <div class="${badgeClass}">${escapeHtml(trustState)}${validationLabel ? ` · ${escapeHtml(validationLabel)}` : ''}</div>
        <div class="issuer-block">
          <div class="issuer-block__domain">Signed by: ${escapeHtml(domain)}</div>
          ${validationLabel ? `<div class="issuer-block__meta">Validation label: ${escapeHtml(validationLabel)}</div>` : ''}
          <div class="issuer-block__meta">Claimed name: ${escapeHtml(claimedName)}</div>
          <div class="issuer-block__fingerprint">Key fingerprint: ${escapeHtml(fingerprint)}</div>
        </div>
        <p class="small-note" style="margin-top:0.55rem;">${escapeHtml(reason)}</p>
        <div class="result-ladder">
          ${ladderRow('Structure', structureState, statusTextMap[structureState])}
          ${ladderRow('Issuer', issuerState, statusTextMap[issuerState])}
          ${ladderRow('Signature', signatureState, signatureState === 'skip' ? 'not present' : statusTextMap[signatureState])}
        </div>
        <div class="caveat-banner">This verifies domain/key control. It does not certify assessment quality or accreditation.</div>
      `;
    } catch (error) {
      challengeResultCard.innerHTML = `<div class="caveat-banner">Challenge verification failed: ${escapeHtml(error.message)}</div>`;
    }
  }

  if (challengeStartButton) {
    challengeStartButton.addEventListener('click', (event) => {
      event.preventDefault();
      runChallengeVerification();
    });
  }

  const challengePageUrl = `${window.location.origin}/challenge.html`;
  if (challengeShareLink) {
    challengeShareLink.textContent = challengePageUrl;
  }
  if (challengeShareText) {
    challengeShareText.textContent =
      `I just verified an Open Badge in under 60 seconds - domain-bound signature, public endpoint, no account needed. Try it: ${challengePageUrl}`;
  }

  if (challengeShareX) {
    const text = challengeShareText ? challengeShareText.textContent : challengePageUrl;
    challengeShareX.href = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }
  if (challengeShareLinkedIn) {
    challengeShareLinkedIn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(challengePageUrl)}`;
  }
  if (challengeShareMastodon) {
    const text = challengeShareText ? challengeShareText.textContent : challengePageUrl;
    challengeShareMastodon.href = `https://mastodon.social/share?text=${encodeURIComponent(text)}`;
  }

  const promptForm = document.getElementById('prompt-badge-form');
  const promptResult = document.getElementById('prompt-badge-result');
  if (promptForm && promptResult) {
    promptForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(promptForm);
      const payload = {
        learnerName: String(formData.get('learnerName') || '').trim() || undefined,
        sourceUrl: String(formData.get('sourceUrl') || '').trim() || undefined,
        summary: String(formData.get('summary') || '').trim(),
        proficiency: String(formData.get('proficiency') || '').trim() || undefined,
        badgeName: String(formData.get('badgeName') || '').trim() || undefined,
        skills: String(formData.get('skills') || '')
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      };

      promptResult.style.display = 'block';
      promptResult.innerHTML = '<p class="small-note">Generating signed demo badge...</p>';

      try {
        const response = await fetch('/public/api/demo/prompt-to-badge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        const validationLabel = result.validationLabel || 'DEMO';
        const issuerDomain = result.issuerDomain || 'example.com';
        const badgeUrl = safeHttpUrl(result.badgeUrl);
        const verifyUrl = safeHttpUrl(result.verifyUrl);

        promptResult.innerHTML = `
          <div class="trust-badge trust-badge--demo">${escapeHtml(result.trustState || 'DEMO_DOMAIN_VERIFIED_SIGNATURE')} · ${escapeHtml(validationLabel)}</div>
          <p style="margin-top:0.5rem;"><strong>Issuer Domain:</strong> ${escapeHtml(issuerDomain)}</p>
          <p style="margin-top:0.5rem;"><strong>Badge URL:</strong> <a id="prompt-badge-url-link" target="_blank" rel="noreferrer"></a></p>
          <p><strong>Verify URL:</strong> <a id="prompt-verify-url-link" target="_blank" rel="noreferrer"></a></p>
          <div class="share-template"><pre id="prompt-share-text"></pre></div>
          <button class="copy-btn copy-btn-light" type="button" data-copy-target="prompt-share-text" style="margin-top:0.5rem;">Copy share text</button>
          <div class="caveat-banner">This verifies domain/key control. It does not certify assessment quality or accreditation.</div>
        `;

        const badgeLink = document.getElementById('prompt-badge-url-link');
        if (badgeLink) {
          badgeLink.href = badgeUrl;
          badgeLink.textContent = String(result.badgeUrl || badgeUrl);
        }

        const verifyLink = document.getElementById('prompt-verify-url-link');
        if (verifyLink) {
          verifyLink.href = verifyUrl;
          verifyLink.textContent = String(result.verifyUrl || verifyUrl);
        }

        const shareTextEl = document.getElementById('prompt-share-text');
        if (shareTextEl) {
          shareTextEl.textContent = String(result.shareText || '');
        }

        const dynamicCopyButton = promptResult.querySelector('.copy-btn[data-copy-target]');
        if (dynamicCopyButton) {
          dynamicCopyButton.addEventListener('click', async () => {
            const targetId = dynamicCopyButton.getAttribute('data-copy-target');
            const target = targetId ? document.getElementById(targetId) : null;
            if (!target) return;
            try {
              await navigator.clipboard.writeText(target.textContent || '');
              dynamicCopyButton.textContent = 'Copied';
              window.setTimeout(() => {
                dynamicCopyButton.textContent = 'Copy share text';
              }, 1200);
            } catch {
              dynamicCopyButton.textContent = 'Copy failed';
              window.setTimeout(() => {
                dynamicCopyButton.textContent = 'Copy share text';
              }, 1200);
            }
          });
        }
      } catch (error) {
        promptResult.innerHTML = `<div class="caveat-banner">Could not generate demo badge: ${escapeHtml(error.message)}</div>`;
      }
    });
  }
});
