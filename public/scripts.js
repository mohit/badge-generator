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
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const liveDemoCredentialUrl = `${window.location.origin}/samples/demo-openbadge-v3-signed.json`;
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
});
