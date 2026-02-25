# Plan: Copy & Design System for badges.firmament.works

## Context

This plan serves two purposes:
1. **Critical review** of `open-badges-trust-network-plan.md` — identifying strengths, issues, and original contributions
2. **Detailed copy and frontend design system** for the badges.firmament.works website, aligned with the revised plan's direction

The site is hosted at **badges.firmament.works** and created by **[Firmament Works](https://firmament.works)**.

---

# Part 1: Plan Review

## Strengths

### 1. Two-state trust model is the right call
The `UNVERIFIED` / `DOMAIN_VERIFIED_SIGNATURE` binary is honest and defensible. Most badge platforms overload "verified" to imply assessment quality — this plan explicitly refuses to do that. The caveat language ("This verifies domain/key control. It does not certify assessment quality or accreditation") is a genuine differentiator.

### 2. Domain-bound identity is concrete and inspectable
Tying issuer identity to domain control (not platform accounts) is the right primitive. It mirrors how TLS/PKI works, is auditable by third parties, and avoids a centralized registry bottleneck. The `.well-known/openbadges-issuer.json` pattern is already standard-adjacent.

### 3. Step 0 "Prompt-to-Badge" activation loop
This is the most commercially interesting idea. Instead of starting with enterprise onboarding, it starts with individual enthusiasm and shareability. The "verify this badge yourself in under 60 seconds" challenge page is a genuinely viral mechanic.

### 4. KPIs are outcome-oriented
`new_verified_domains` as the primary KPI is correct — it measures ecosystem growth, not vanity metrics. Supporting KPIs (challenge completions, share clicks, 7-day conversion) form a coherent funnel.

### 5. Security-first posture is integrated, not bolted on
SSRF protections, rate limiting, per-IP quotas, per-domain cooldown, request size limits — all in scope from the start. The Railway budget cap ($100/month) is pragmatic.

## Issues

### 1. "Prompt-to-Badge" depends on AI assessment but the plan doesn't scope the AI surface
The plan describes "User provides source text/link → Assistant generates skill list + assessment questions → User answers → Assistant scores → Badge issued." But:
- Where does the "Assistant" live? Is it the MCP server? A separate LLM integration? A Claude conversation?
- Who pays for the LLM inference? Is this a cost the $100/mo Railway budget absorbs?
- The `assessment_mode: ai_assisted` field is defined but the runtime that produces it is not.
- **Recommendation**: Scope v1 prompt-to-badge as an MCP/Claude Desktop flow only (no server-side LLM). The badge generator server signs and hosts; the AI assessment happens client-side in the user's Claude session.

### 2. Trust discovery APIs are underspecified
`GET /public/api/trust/issuer/:domain`, `GET /public/api/trust/events/:domain`, `GET /public/api/trust/issuers?status=...` are listed but no response schema is defined. These are the APIs that third parties will build on — they need concrete contracts.

### 3. The "onboard-issuer" CLI wizard is mentioned but not designed
The plan says "non-technical setup" but the CLI is inherently technical. What does this wizard actually do? Generate keys? Create well-known files? Push them to the user's server? This needs a concrete flow diagram.

### 4. Vision page roadmap conflicts with plan's rollout sequence
The vision page describes Foundation → Integrations → Network effects, but the plan's rollout is oriented around a 7-week sprint. These need reconciliation — the vision page should reflect the actual near-term work.

### 5. No explicit data model for trust events
The plan mentions `trust/events/:domain` but doesn't define what a trust event is (schema, lifecycle, retention). Is it an append-only log? Can events expire? This matters for the trust discovery API.

### 6. Share mechanics are described but not designed
"3 short post templates" and "one demo script" are deliverables without any content specification. What do these templates say? For which platforms? This is where the growth thesis lives or dies.

## Original Contributions

1. **Domain-bound signature verification as the canonical trust primitive** — not novel in PKI but novel in the badge ecosystem, where "verified" usually means "we checked the issuer profile JSON exists."
2. **Explicit separation of domain trust from assessment quality** — most badge platforms conflate these. The caveat copy is a genuine contribution to how verification results should be communicated.
3. **Prompt-to-badge as a growth loop** — using AI-assisted assessment to bootstrap badge creation is new. The viral mechanic (challenge page → key generation → domain publish → first badge) is a concrete funnel.
4. **SSRF-hardened public verifier** — most Open Badges implementations don't treat the verifier as an attack surface. This one does.
5. **llms.txt + MCP as first-class integration surface** — treating AI agents as a primary user persona alongside humans is forward-looking.

---

# Part 2: Current Website Copy & Design Audit

## Current State Summary

### Pages
| Page | URL | Purpose | State |
|------|-----|---------|-------|
| Home | `/` | Landing, value prop, trust ladder | Solid foundation |
| Verify | `/verify.html` | Public credential verifier | Functional, needs trust-state upgrade |
| Vision | `/vision.html` | Manifesto + roadmap | Needs alignment with plan |
| API | `/api.html` | Endpoint reference + quickstart | Good, needs trust API additions |

### Current Copy Voice
- Technical-professional, slightly impersonal
- Addresses "schools, workforce teams, and learning platforms" — correct but generic
- Overuses "infrastructure" and "trust" without grounding them in concrete user stories
- "The Let's Encrypt moment for credentials" is the strongest line on the site — but it only appears as a small CTA band and as the vision page title

### Current Design Strengths
- Clean typography system (Fraunces display + IBM Plex body/mono)
- Semantic color palette (trust blue, verify teal, warn amber, risk red)
- Well-structured component library (cards, pills, signal stacks, code blocks)
- Responsive breakpoints at 980/860/640px
- Scroll-triggered animations are subtle and purposeful
- Sticky header with blur backdrop is polished

### Current Design Issues
- **No favicon or OG image** — critical for share links and the viral growth loop
- **No visual identity beyond the gradient dot** — the logo-mark is a 0.65rem circle; needs more presence
- **Cards are uniform** — every section uses the same card pattern; visual monotony across pages
- **No illustration or diagram** — the trust ladder in the hero is text-only; a visual diagram would communicate the concept faster
- **Footer is minimal** — no Firmament Works branding/link, no legal, no contact
- **No "Try it" state on homepage** — the demo CTA exists but doesn't show what happens after clicking
- **Color palette lacks warmth** — the blue/teal scheme is professional but cold; no accent that signals approachability

---

# Part 3: Copy System

## Brand Voice

### Positioning Statement
Firmament Works builds open trust infrastructure for credentials. badges.firmament.works is the reference implementation: free, self-hostable, and standards-aligned.

### Voice Attributes
| Attribute | Description | Example |
|-----------|-------------|---------|
| **Direct** | State what it does, not what it aspires to | "Sign badges with Ed25519. Verify them against the issuer's domain." not "Enabling a future of trustworthy credentials" |
| **Precise** | Use exact terms; don't hedge | "Domain-verified signature" not "enhanced trust level" |
| **Honest about scope** | Say what it doesn't do | "This verifies domain/key control. It does not certify assessment quality." |
| **Operator-first** | Write for people who build systems | "Deploy anywhere. Issue via API. Verify without authentication." |

### Terminology Table
| Term | Use | Avoid |
|------|-----|-------|
| Badge | For the credential artifact | Credential (except in W3C context), certificate, cert |
| Issuer | The entity that signs and publishes | Provider, organization (too generic) |
| Verifier | The person or system checking a badge | Validator, checker |
| Domain-verified | Trust state where signature + domain resolve | Trusted, certified, accredited |
| Unverified | Trust state where verification fails | Untrusted, invalid, suspicious |
| Trust state | The verification outcome category | Trust level (implies hierarchy beyond 2 states) |
| Signed | Badge has a cryptographic proof block | Certified, authenticated |

### Copy Patterns

**Headlines**: Imperative or declarative. No questions. No "Introducing..." or "Meet..."
- Good: "Sign badges. Verify domains. Share proof."
- Bad: "What if credentials were as easy to verify as websites?"

**Body text**: Short paragraphs (2-3 sentences max). Lead with what the user can do, not what the system is.
- Good: "Paste a badge URL and get a trust verdict in seconds. The verifier checks structure, issuer reachability, and cryptographic signature."
- Bad: "Our advanced verification infrastructure provides multi-layered trust assessment capabilities."

**CTAs**: Verb + object. Specific.
- Good: "Verify a badge", "Read the API docs", "Generate your keys"
- Bad: "Get started", "Learn more", "Try it now"

**Caveats**: Always present, never buried. Use the exact locked phrases from the plan.

## Page-by-Page Copy

### Homepage (index.html)

**Kicker**: `Open Trust Infrastructure`
**H1**: `Sign badges. Verify domains. Share proof.`
**Subhead**: `Issue Open Badges with domain-bound signatures and verify them through public endpoints — no API key, no account, no lock-in.`

**CTA row**:
1. `Verify a badge` (primary) → /verify.html
2. `Try prompt-to-badge demo` (primary-outline) → demo flow (new, per plan Step 0)
3. `See the API` (secondary) → /api.html

**Hero proof card** (trust ladder): Keep current structure but add the trust state label:
```
Trust state        DOMAIN_VERIFIED_SIGNATURE
Structure check    pass
Issuer check       pass
Signature check    pass
```
Add the caveat line below: *"Verifies domain/key control. Does not certify assessment quality."*

**Section: "What this proves"** (replaces "Infrastructure guarantees")
- **Card 1 — "Domain-bound signatures"**: "Badges are signed with Ed25519 keys. Verification resolves the signing key against the issuer's domain. If the key is discoverable at the claimed domain, the badge is domain-verified."
- **Card 2 — "Public verification"**: "Anyone can verify any badge through public API endpoints. No account, no API key. SSRF protections ensure the verifier is safe for untrusted input."
- **Card 3 — "Two trust states"**: "A badge is either DOMAIN_VERIFIED_SIGNATURE or UNVERIFIED. Nothing in between. Assessment quality is the issuer's responsibility, not the verifier's claim."

**Section: "Issue in four API calls"**: Keep current structure. Add "or use the CLI" subtext.

**Section: "For issuers / For verifiers"**: Keep current 2-column layout.

**Vision CTA band**:
- H2: `"The Let's Encrypt direction for credentials"`
- Body: `Free, interoperable trust rails for anyone who issues or verifies learning credentials. Built by Firmament Works.`
- CTA: `Read the vision` → /vision.html

### Verify Page (verify.html)

**Kicker**: `Public Verifier`
**H1**: `Check any badge's trust state`
**Subhead**: `Paste a URL, drop in JSON, or inspect an issuer profile. The verifier checks structure, issuer reachability, and signature — then shows you exactly what it found.`

**Result display changes** (per plan's trust-state model):
- Show **issuer domain** first and prominently: `Signed by: example.com`
- Show **trust state badge**: `DOMAIN_VERIFIED_SIGNATURE` (green) or `UNVERIFIED` (red)
- Show **claimed issuer name** as secondary, non-canonical: `Claimed name: Example Academy`
- Show **key fingerprint** in expandable detail
- Always show caveat: *"This verifies domain/key control. It does not certify assessment quality or accreditation."*

**"How to read the verdict" sidebar**: Update to reflect two-state model:
```
DOMAIN_VERIFIED_SIGNATURE
  Signature is valid and key is currently discoverable for this domain.

UNVERIFIED
  Issuer cannot be cryptographically verified.
```

### Vision Page (vision.html)

**Kicker**: `Vision`
**H1**: `The Let's Encrypt moment for credentials`
**Subhead**: `Credentials should be as easy to verify as HTTPS certificates: open standards, no lock-in, and strong proof by default.`

**Section: "What's here now"** (replaces "What is concrete in this implementation"):
- Domain-bound signing with Ed25519
- Public verification with SSRF hardening
- API, CLI, and MCP access
- llms.txt for agent discovery

**Section: "What's next"** (replaces generic roadmap):
- **Now**: Domain/key trust — two-state verification, prompt-to-badge demo, share-ready challenge pages
- **Next**: Trust discovery APIs, onboarding wizard, non-technical issuer docs
- **Later**: Vouching/circles-of-trust for higher-order reputation

**Design principles**: Keep current three (public verifiability, issuer accountability, operator ergonomics).

### API Page (api.html)

**Changes**:
- Add "Trust discovery" as a new endpoint group (per plan: `trust/issuer/:domain`, `trust/events/:domain`, `trust/issuers?status=...`)
- Separate "Public verify/trust APIs" from "Authenticated issuance APIs" more clearly (per plan directive)
- Add one full no-key verification curl example with response JSON
- Add one trust-write curl example with response JSON

---

# Part 4: Frontend Design System

## Design Tokens (CSS Custom Properties)

### Colors — Keep and Extend

```css
/* Existing — keep */
--ink: #0b1020;
--ink-soft: #1a2238;
--paper: #f6f8fb;
--surface: #ffffff;
--steel: #5b6475;
--line: #d6dbe6;
--trust: #1d4ed8;
--trust-deep: #173ea8;
--verify: #0f766e;
--warn: #b45309;
--risk: #b91c1c;

/* New — add */
--trust-light: #eff4ff;       /* Light background for trust-themed sections */
--verify-light: #ecfdf5;      /* Light background for success states */
--warn-light: #fffbeb;        /* Light background for warning states */
--risk-light: #fef2f2;        /* Light background for error states */
--ink-muted: #374155;         /* Tertiary text, less prominent than steel */
--surface-raised: #ffffff;    /* Cards that need more lift */
--surface-sunken: #f1f4f9;    /* Inset areas, code backgrounds on light */
```

### Typography — Keep Current

```css
--font-display: 'Fraunces', Georgia, serif;
--font-body: 'IBM Plex Sans', 'Segoe UI', sans-serif;
--font-mono: 'IBM Plex Mono', 'SFMono-Regular', monospace;
```

**Type scale** (add explicit scale):
```css
--text-xs: 0.75rem;    /* 12px — fine print, status pills */
--text-sm: 0.84rem;    /* ~13.4px — help text, notes */
--text-base: 0.95rem;  /* ~15.2px — body copy */
--text-md: 1.05rem;    /* ~16.8px — card headings */
--text-lg: 1.2rem;     /* ~19.2px — panel titles */
--text-xl: clamp(1.7rem, 4vw, 2.5rem);   /* section titles */
--text-hero: clamp(2.2rem, 5.3vw, 4rem); /* hero h1 */
```

### Spacing — Formalize

```css
--space-xs: 0.35rem;
--space-sm: 0.65rem;
--space-md: 1rem;
--space-lg: 1.35rem;
--space-xl: 2rem;
--space-2xl: 4.4rem;   /* Section padding */
```

### Border Radius — Keep

```css
--radius-sm: 10px;
--radius-md: 14px;
--radius-lg: 18px;
--radius-pill: 999px;
```

### Shadows — Keep and Add

```css
--shadow-card: 0 10px 32px rgba(12, 25, 58, 0.09);
--shadow-soft: 0 6px 20px rgba(12, 25, 58, 0.08);
--shadow-lifted: 0 14px 40px rgba(12, 25, 58, 0.12);  /* Hover state for cards */
```

## Component Inventory

### Existing Components — Keep
| Component | Class | Notes |
|-----------|-------|-------|
| Button primary | `.btn-primary` | Trust blue, pill radius |
| Button secondary | `.btn-secondary` | Bordered, white bg |
| Card | `.card` | Border + shadow + radius-md |
| Panel | `.panel` | Larger container card |
| Signal stack | `.signal-stack` + `.signal-row` | Trust ladder rows |
| Status pill | `.status-pass/warn/fail/skip` | Semantic color indicators |
| Code block | `.code-block` | Dark bg with copy button |
| Code chip | `.code-chip` | Inline dark code snippet |
| Verify tabs | `.verify-tab` | Pill-shaped tab selector |
| CTA band | `.cta-band` | Gradient border promo strip |

### New Components Needed

#### 1. Trust State Badge
A prominent, standalone indicator of the two trust states.

```
.trust-badge                     — Base wrapper
.trust-badge--verified           — Green/teal for DOMAIN_VERIFIED_SIGNATURE
.trust-badge--unverified         — Red for UNVERIFIED
```

Display: Icon + text label. Larger than status-pill. Used in verify results as the primary outcome indicator.

#### 2. Issuer Identity Block
Per plan: show domain first, claimed name second, with canonical/non-canonical labels.

```
.issuer-block                    — Container
.issuer-block__domain            — Primary: bold domain text
.issuer-block__name              — Secondary: claimed name (muted)
.issuer-block__fingerprint       — Tertiary: key fingerprint (expandable, mono)
```

#### 3. Caveat Banner
The universal trust caveat that must appear on every verification result.

```
.caveat-banner                   — Amber/neutral border, light background
```

Always contains the locked copy: "This verifies domain/key control. It does not certify assessment quality or accreditation."

#### 4. Demo CTA Card (Step 0)
A larger, more visual CTA for the prompt-to-badge demo flow.

```
.demo-card                       — Gradient background, larger padding
.demo-card__title                — Bold headline
.demo-card__description          — Body text
.demo-card__action               — CTA button
```

#### 5. Challenge Page Components (Step 0)
For the "Verify this badge yourself in under 60 seconds" share page:

```
.challenge-header                — Timer/progress visual
.challenge-step                  — Numbered step in the challenge flow
.challenge-result                — Outcome card (pass/fail)
```

## Layout Patterns

### Page Structure (all pages)
```
header.site-header
  nav.site-nav.container
main#main-content
  section.{page}-hero             — Hero with kicker, h1, subhead, CTAs
  section.section[.section-muted] — Content sections
footer
  .container.footer-row
```

### Grid System — Keep Current
- `.grid-2` — 2-column equal
- `.grid-3` — 3-column equal
- `.hero-grid` — 1.05fr / 0.95fr asymmetric
- `.verify-layout` — 1.12fr / 0.88fr asymmetric
- `.api-layout` — 0.95fr / 1.05fr asymmetric
- `.api-steps` — 4-column equal (step cards)

All collapse to single column at 980px.

### Responsive Breakpoints — Keep
- `980px` — Grid collapse
- `860px` — Mobile nav
- `640px` — Tight spacing, full-width CTAs

---

# Part 5: Prompt-to-Badge Demo Flow (Step 0)

## Overview
The demo is a web-based flow hosted at `/challenge.html` that lets a visitor verify a pre-signed badge in under 60 seconds, then optionally begin issuing their own. This page is the primary share target for social posts and the top-of-funnel for `new_verified_domains`.

## Challenge Page: `/challenge.html`

### User Journey
```
1. Visitor lands on challenge.html (via share link)
2. Sees: "Verify this badge yourself in under 60 seconds"
3. Clicks "Start challenge"
4. Page auto-loads the signed sample badge URL into the verifier
5. Verification runs, result renders with trust state + issuer domain
6. Visitor sees: "Badge verified. Want to issue your own?"
7. Two paths:
   a. "Share this result" → copy share link / social template
   b. "Issue your first badge" → guided flow: generate keys →
      publish well-known → verify domain → issue badge
```

### Page Structure

**Hero**:
- Kicker: `Open Badges Challenge`
- H1: `Verify this badge in under 60 seconds`
- Subhead: `Click the button below. We'll show you exactly what a domain-verified badge looks like — structure, issuer, signature, verdict.`
- CTA: `Start the challenge` (primary)

**Challenge area** (appears after clicking Start):
- Embedded verification result (reuses the verify result rendering from verify.html)
- Shows the full trust ladder with `DOMAIN_VERIFIED_SIGNATURE` outcome
- Shows issuer domain, claimed name, key fingerprint
- Shows caveat banner

**Post-challenge CTAs**:
- **Share section**:
  - H3: `Share the result`
  - Pre-filled share text: `"I just verified an Open Badge in under 60 seconds — domain-bound signature, public endpoint, no account needed. Try it: [challenge URL]"`
  - Copy button for share text
  - Direct link buttons for Twitter/X, LinkedIn, Mastodon (pre-populated with share text + URL)
- **Conversion section**:
  - H3: `Issue your first badge`
  - Body: `You just verified someone else's badge. Now make your own. You'll need a domain, an Ed25519 key pair, and five minutes.`
  - Step cards:
    1. `Generate keys` — link to CLI docs or MCP tool
    2. `Publish .well-known/openbadges-issuer.json` — template + instructions
    3. `Verify your domain` — link to POST /public/api/issuers/verify
    4. `Issue and sign your first badge` — link to API quickstart

### Prompt-to-Badge Demo (interactive)
This is a separate section on the challenge page (below the verification challenge) or a linked sub-flow:

- **Input**: Text area for "What did you learn?" + optional source URL
- **Output**: The server's existing badge creation API is called with user-provided metadata. The AI assessment part is not server-side — instead, the demo:
  1. Asks the user to describe what they learned (free text)
  2. Asks them to self-assess proficiency (beginner/intermediate/advanced)
  3. Pre-fills a badge payload with their input as `assessment_summary`
  4. Signs it with the server's demo keys
  5. Returns a verify URL they can share

- **Assessment mode**: `self` for v1 (user provides their own summary). The `ai_assisted` mode lives in the MCP/Claude Desktop integration, not the web demo.

### Share Templates (3 post templates from plan)

**Template 1 — Challenge share (Twitter/X)**:
> I just verified an Open Badge in under 60 seconds. Domain-bound Ed25519 signature, public API, no account needed.
> Try it yourself: {challenge_url}

**Template 2 — First badge share (LinkedIn)**:
> I just issued my first cryptographically signed Open Badge. The issuer is verified by domain control, not a platform account. The whole stack is open source.
> Verify it: {verify_url}

**Template 3 — Technical share (Dev communities)**:
> Open Badges with domain-bound Ed25519 signatures. SSRF-hardened public verifier. Self-hostable. No vendor lock-in.
> Verify a sample: {challenge_url}
> Source: {github_url}

---

# Part 6: Implementation Sequence

## Step 1: Brand Assets
- Generate `/public/favicon.svg` — SVG using the trust-blue to verify-teal gradient, shield/badge shape
- Generate `/public/og-image.png` — 1200x630, uses Fraunces + IBM Plex, shows "badges.firmament.works" + tagline + trust ladder preview

## Step 2: CSS Design System Updates (`/public/styles.css`)
- Add new color tokens (light variants, ink-muted, surface-sunken)
- Add type scale tokens
- Add spacing scale tokens
- Add `--radius-pill` token
- Add `--shadow-lifted` token
- Add `.trust-badge`, `.trust-badge--verified`, `.trust-badge--unverified`
- Add `.issuer-block` and children
- Add `.caveat-banner`
- Add `.demo-card` and children
- Add `.challenge-*` components
- Add `.share-template` component (copyable text block)

## Step 3: Homepage Updates (`/public/index.html`)
- Update `<head>` with favicon + OG meta tags
- Rewrite hero copy (H1, subhead, CTAs)
- Update trust ladder card with trust state label + caveat
- Rewrite "Infrastructure guarantees" → "What this proves" with new card copy
- Add prompt-to-badge demo CTA (links to /challenge.html)
- Update footer with "Built by [Firmament Works](https://firmament.works)"

## Step 4: Verify Page Updates (`/public/verify.html`)
- Update `<head>` with favicon + OG meta tags
- Rewrite hero copy
- Update `showBadgeResult()` to render trust-state badge, issuer-block, caveat-banner
- Update "How to read the verdict" sidebar to two-state model
- Update footer

## Step 5: Vision Page Updates (`/public/vision.html`)
- Update `<head>` with favicon + OG meta tags
- Rewrite roadmap to Now/Next/Later
- Add explicit trust-state scope ("now: domain/key trust; later: vouching")
- Update footer

## Step 6: API Page Updates (`/public/api.html`)
- Update `<head>` with favicon + OG meta tags
- Add trust discovery endpoint group
- Improve public vs authenticated separation
- Add full curl + response JSON examples
- Update footer

## Step 7: Challenge Page (`/public/challenge.html`)
- Build complete page per spec above
- Wire "Start challenge" to auto-verify the signed sample
- Build share template section with copy buttons
- Build "Issue your first badge" conversion flow with step cards
- Build prompt-to-badge self-assessment demo form
- Wire demo form to existing badge creation + signing API endpoints

## Step 8: Scripts Updates (`/public/scripts.js`)
- Add challenge page logic (start challenge, share copy, demo form submission)
- No changes needed for existing pages (verify.html has inline scripts)

---

# Part 7: Files Summary

### Files to Create
| File | Purpose |
|------|---------|
| `/public/challenge.html` | Step 0 challenge + prompt-to-badge demo page |
| `/public/favicon.svg` | SVG favicon (gradient shield/badge mark) |
| `/public/og-image.png` | Open Graph share image (1200x630) |

### Files to Modify
| File | Changes |
|------|---------|
| `/public/styles.css` | New tokens, new components (trust-badge, issuer-block, caveat-banner, demo-card, challenge, share-template) |
| `/public/index.html` | Rewritten copy, new CTAs, OG meta, favicon, updated footer |
| `/public/verify.html` | Trust-state result rendering, issuer identity block, caveat banner, OG meta, favicon, updated footer |
| `/public/vision.html` | Now/Next/Later roadmap, trust scope statement, OG meta, favicon, updated footer |
| `/public/api.html` | Trust discovery endpoints, clearer public/auth separation, curl examples, OG meta, favicon, updated footer |
| `/public/scripts.js` | Challenge page logic, demo form handler |

### Files NOT Modified
| File | Reason |
|------|--------|
| `server.js` | No backend changes needed — demo uses existing endpoints |
| `cli/badge-cli.js` | CLI changes are separate scope |
| `mcp-server/index.js` | MCP changes are separate scope |

### Meta Tags to Add (all HTML pages)
```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="{Page title}">
<meta property="og:description" content="{Page description}">
<meta property="og:image" content="https://badges.firmament.works/og-image.png">
<meta property="og:url" content="https://badges.firmament.works/{path}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
```

---

# Part 8: Verification / Testing

1. **Visual regression**: Open each page at 1440px, 980px, 768px, 375px — check for layout breaks and copy overflow
2. **Copy audit**: Confirm all locked caveat phrases appear verbatim in verify results and challenge page
3. **Trust state rendering**: Verify the signed sample badge and confirm result shows `DOMAIN_VERIFIED_SIGNATURE` with domain-first issuer identity
4. **Challenge flow**: Walk through challenge.html start-to-finish; confirm badge auto-verifies, result renders correctly, share copy works
5. **Share links**: Confirm `/verify.html?url=...&autoverify=1` auto-runs verification; confirm `/challenge.html` share templates contain correct URLs
6. **Demo form**: Submit a self-assessment through the prompt-to-badge demo; confirm badge is created, signed, and verifiable
7. **OG tags**: Use opengraph.dev or Twitter card validator to confirm share previews render for all 5 pages
8. **Accessibility**: Skip links, focus outlines, aria-live on dynamic results, screen reader on trust-badge and caveat-banner
9. **Favicon**: Confirm favicon appears in all major browsers
10. **Footer**: Confirm "Built by Firmament Works" links correctly to https://firmament.works on all pages
