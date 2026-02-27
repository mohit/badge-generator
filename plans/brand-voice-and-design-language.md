# Brand Voice & Design Language: Signet by Firmament Works

**Version**: 1.0 — Creative Brief
**Date**: 2026-02-27
**Scope**: Complete brand identity, voice, design language, and content strategy for badges.firmament.works
**Status**: Proposal for review

---

## Executive Summary

This document defines a contemporary, bold brand identity for the Open Badge verification and issuance infrastructure at badges.firmament.works. It draws on extensive research into the Open Badges ecosystem, competitor positioning (Credly, Badgr/Canvas Credentials, Accredible), employer perception data, the Let's Encrypt brand model, and the specific needs of our primary audience: education professionals and badge enthusiasts.

The core strategic insight: **every competitor talks about issuing. Nobody talks about trust.** The market is full of "badge platforms" competing on features, integrations, and white-labeling. Not a single one has claimed the position of *neutral, public trust infrastructure*. That position is ours.

---

# 1. Brand Positioning

## 1.1 Brand Name Evaluation

### On "Signet"

**Signet** (from Latin *signum* — a seal of authenticity) is strong on etymology. A signet ring was historically how you proved a document was genuine — a personal, physical stamp of trust. This maps directly to what the product does: cryptographic proof of issuer identity.

**Strengths:**
- Etymologically perfect for a signing/verification tool
- Short, distinctive, memorable
- Not already claimed in the ed-tech/credentials space
- Works as both a noun ("a Signet credential") and a verb-adjacent concept ("Signet it")
- The seal/stamp metaphor is intuitive across cultures

**Weaknesses:**
- No immediate association with education, badges, or credentials
- Sounds vaguely like a jewelry brand or a fantasy RPG item to a cold audience
- "Signet ring" connotation is aristocratic/old-world — may feel elitist to an education audience
- The "by Firmament Works" byline adds cognitive load without adding meaning for first-time visitors

**Recommendation: Keep "Signet" but reposition how it's introduced.**

Don't lead with the name cold. Lead with the mission, then let the name land as the tool that delivers it. The name works once people understand the concept of domain-bound signing — it just shouldn't be the first thing they have to decode.

Drop "by Firmament Works" from the primary logo treatment on the site. Firmament Works can appear in the footer and legal contexts. The header should just say **Signet** — clean, confident, no parenthetical.

### Alternative names considered and rejected

| Name | Why rejected |
|------|-------------|
| BadgeProof | Too literal, sounds like a testing tool |
| TrustMint | Crypto/blockchain connotation |
| OpenSeal | Good but "Open" prefix is overused in ed-tech |
| Verified.badges | Domain-style names feel dated |
| Hallmark | Taken (and trademark risk) |
| Stamp | Too generic |

**Verdict: Signet stays.** It's distinctive, etymologically grounded, and will grow in resonance as users understand the product. The fix is in the introduction, not the name.

## 1.2 Tagline & Positioning Statement

### Primary tagline

> **Trusted badges. Open proof.**

This is the billboard version. Four words. It captures both sides of the value: your badges carry trust, and the proof is open for anyone to check.

### Secondary tagline (for contexts where more explanation is needed)

> **Free, open infrastructure for verifiable credentials.**

Echoes Let's Encrypt's "free, automated, open" but adapted for our domain. Use this on the OG image, in API docs, and on social bios.

### Positioning statement (internal use)

> Signet is the public trust layer for Open Badges. Like Let's Encrypt made HTTPS free and inevitable, Signet makes credential verification free, open, and independent of any platform. We don't issue badges for you — we make every badge you issue trustworthy.

### 30-second elevator pitch

> "You know how Let's Encrypt made HTTPS free and automatic? Signet does that for digital credentials. If you're a university, bootcamp, or employer issuing Open Badges, Signet lets you sign them with your own domain, verify them publicly, and prove they're real — without paying Credly $2,000 a year or getting locked into any platform. It's free, it's open, and anyone can check a badge's trust status in one click."

### The Let's Encrypt parallel, made specific

| Let's Encrypt | Signet |
|---------------|--------|
| "Your site should have HTTPS" | "Your badges should be verifiable" |
| Domain validation via ACME | Domain validation via `.well-known/openbadges-issuer.json` |
| Free TLS certificates | Free badge signing & verification |
| Certificate Transparency logs | Public trust ledger |
| Works with any web host | Works with any badge platform |
| Made encryption inevitable | Making badge trust inevitable |

## 1.3 Brand Archetype

**The Public Utility** — like a municipal water system or the postal service, but with the design quality of Stripe and the mission clarity of Let's Encrypt.

We are not a platform. We are not a marketplace. We are infrastructure that makes the whole ecosystem more trustworthy. Platforms come and go. Infrastructure endures.

---

# 2. Brand Voice

## 2.1 Voice Attributes

### Direct
We say what we mean in the fewest words possible. No hedge language, no qualifiers, no "solutions."

| Instead of | We say |
|------------|--------|
| "Our comprehensive verification solution enables organizations to..." | "Verify any badge. One click." |
| "Signet provides a robust framework for establishing distributed trust..." | "Signet proves who signed a badge." |
| "We are committed to supporting the open credentials ecosystem..." | "Open Badges deserve open verification." |

### Honest
We tell you exactly what we verify and what we don't. We never overstate. Our caveat language is a feature, not a disclaimer.

| Instead of | We say |
|------------|--------|
| "Verified credential" (implying we checked the assessment) | "Domain-verified signature" |
| "Trusted issuer" | "Issuer identity confirmed via domain" |
| *(Hiding limitations)* | "This proves who signed it. It doesn't prove the assessment was good." |

### Warm but not cute
We're approachable without being folksy. We talk to education professionals as peers — people who care deeply about what credentials mean.

| Instead of | We say |
|------------|--------|
| "Hey there! Ready to badge-ify your learning? 🎉" | "Ready to issue your first badge?" |
| "LEVERAGE OUR ENTERPRISE-GRADE CREDENTIAL INFRASTRUCTURE" | "Sign badges with your domain. Verify them anywhere." |
| "Our team is passionate about democratizing..." | "Every learner deserves proof that can be checked." |

### Confident
We don't ask permission to exist. We don't position ourselves as "an alternative to Credly." We are the trust layer. The others are platforms.

| Instead of | We say |
|------------|--------|
| "Consider Signet as an alternative to..." | "Platforms lock you in. Standards set you free." |
| "We hope to eventually..." | "Here's what's live now. Here's what's next." |
| "We believe that maybe..." | "Badges without verification are just images." |

## 2.2 Tone Spectrum

The voice stays constant. The tone shifts by context.

```
Casual ◄────────────────────────────────► Authoritative

[Challenge page]  [Home]  [Issuer guide]  [API docs]  [Trust model]
  "Try it."      "Here's   "Step 1:       "POST       "Domain-bound
                  why."     Generate       /api/..."    Ed25519..."
                            keys."
```

- **Challenge / Demo pages**: Conversational, encouraging, action-oriented. "See for yourself."
- **Homepage**: Confident, vision-forward, grounded in specifics. "This is what we do and why it matters."
- **Issuer Setup Guide**: Instructional, patient, step-by-step. Like a good workshop facilitator.
- **API Reference**: Precise, scannable, zero ambiguity. Let code speak.
- **Trust Model / Technical docs**: Rigorous, thorough, citations welcome. For the people who want to understand the cryptography.

## 2.3 Language Do's and Don'ts

### Do

- **Use concrete nouns**: "domain", "signature", "badge", "key" — not "solution", "framework", "ecosystem"
- **Use active voice**: "Signet verifies the signature" — not "the signature is verified by Signet"
- **Lead with the outcome**: "Employers can check any badge in one click" — not "Our verification infrastructure enables employers to..."
- **Name real scenarios**: "A bootcamp graduate applies for a job. The hiring manager clicks the verify link."
- **Acknowledge limitations**: "We prove who signed it. Assessment quality is the issuer's responsibility."
- **Use "you" and "your"**: Address the reader directly
- **Use short sentences**: If a sentence has a comma, consider splitting it
- **Use numbers when we have them**: "700M websites use Let's Encrypt. Zero badge platforms offer free, open verification. Until now."

### Don't

- **Don't say "solution"**: Ever. It means nothing.
- **Don't say "leverage"**: Use "use"
- **Don't say "utilize"**: Use "use"
- **Don't say "ecosystem"** on user-facing pages: It's jargon. Say "community" or "the badge world" or just be specific.
- **Don't say "seamless"**: Everything claims to be seamless. Nothing is.
- **Don't say "empower"**: Overused to the point of meaninglessness. Just describe the capability.
- **Don't use "Web3", "blockchain", or "decentralized"**: We use proven cryptography (Ed25519), not blockchain. Distance from the crypto hype.
- **Don't hide behind passive voice**: "Trust is established through domain validation" → "You prove trust by verifying your domain."
- **Don't use jargon on the homepage**: No "Ed25519", no "SSRF", no "multibase encoding". Save that for the API docs.
- **Don't use scare quotes around competitors**: We don't disparage. We just do it better.

## 2.4 How to Talk About Technical Features to Non-Technical People

| Technical concept | For education professionals |
|---|---|
| Ed25519 cryptographic signatures | "Your badges are signed with a digital seal that can't be forged" |
| Domain-bound trust anchor | "Trust comes from your website address — the same way HTTPS works" |
| `.well-known/openbadges-issuer.json` | "A small file on your website that says 'yes, we issue badges'" |
| Public/private key pair | "A signing key (you keep secret) and a checking key (anyone can use)" |
| SSRF protection | "Our verifier can't be tricked into attacking private networks" |
| Trust ledger | "A public record of which domains have been verified as badge issuers" |
| Open Badges v3 / W3C Verifiable Credentials | "The latest international standard for digital credentials" |
| MCP server | "A way for AI tools like Claude to issue and verify badges on your behalf" |

## 2.5 How to Handle the "Credibility" Objection

The #1 objection from the education audience is: *"Will employers take this seriously?"*

**Our answer has three layers:**

**Layer 1 — Reframe the question:**
"The question isn't whether employers take badges seriously. 95% of employers already see value in micro-credentials. The question is whether they can *verify* them. Right now, most badges are just images with no way to check if they're real."

**Layer 2 — Make verification the differentiator:**
"A Signet-verified badge isn't just an image. It's a cryptographically signed credential that anyone can check — hiring managers, admissions officers, or automated systems. One click. No account needed. Real proof."

**Layer 3 — Use the Let's Encrypt analogy:**
"Before Let's Encrypt, most websites didn't have HTTPS because it was expensive and complicated. Now 80% do, because someone made it free and automatic. The same shift is happening with credentials. The tools to make badges trustworthy are now free and open."

## 2.6 Sample Headlines and Copy

### Homepage hero

**Headline:**
> Every badge should be provable.

**Subhead:**
> Signet is free, open infrastructure for signing and verifying Open Badges. Prove who issued a credential. Check it in one click. No platform. No lock-in. No cost.

### Verify page

**Headline:**
> Check any badge. Right now.

**Subhead:**
> Paste a URL, drop in JSON, or look up an issuer domain. See exactly who signed it and whether the signature checks out.

### Issuer setup page

**Headline:**
> Start issuing trusted badges in 15 minutes.

**Subhead:**
> Generate your keys, host a small file on your domain, and you're a verified issuer. No vendor. No contract. No permission needed.

### API page

**Headline:**
> Build on open trust.

**Subhead:**
> Public verification APIs — no key required. Authenticated issuance and signing for your applications, AI agents, and pipelines.

### Challenge / Demo page

**Headline:**
> Prove it works. In 60 seconds.

**Subhead:**
> Create a signed badge right now and verify it yourself. See what cryptographic trust looks like — no setup, no account, no catch.

---

# 3. Messaging Framework

## 3.1 Primary Message Hierarchy

**Message 1 — The problem (lead with this):**
> Badges without verification are just images. Anyone can fake one. Most can't be checked.

**Message 2 — What we do:**
> Signet lets anyone verify a badge's signature and issuer domain — publicly, instantly, for free.

**Message 3 — How it works:**
> Issuers sign badges with domain-bound keys. Verifiers check signatures against the issuer's published public key. Trust comes from the domain, not a platform.

**Message 4 — Why it matters:**
> When credentials can be independently verified, learners get credit they can prove, employers get signal they can trust, and issuers build reputation that's portable.

**Message 5 — The bigger picture:**
> Like Let's Encrypt did for website security, Signet makes credential trust free, automatic, and open. The infrastructure layer that makes the whole badge ecosystem work.

## 3.2 Value Propositions, Ranked by Audience Priority

For **education professionals and badge program managers**:

1. **"Employers can verify your badges in one click"** — addresses the #1 credibility concern
2. **"No vendor lock-in, ever"** — addresses the #2 concern as Badgr goes paid and Credly is expensive
3. **"Free — as in actually free, not free-trial-then-$2000/year"** — addresses budget reality
4. **"Works with the badges you already issue"** — reduces perceived switching cost
5. **"Your domain, your trust"** — appeals to institutional pride and brand ownership
6. **"AI-ready"** — forward-looking, differentiating

## 3.3 Competitor Counter-Positioning (Without Naming Names)

We don't attack competitors. We describe a world where our approach is obviously better.

| What competitors do | How we frame it |
|---|---|
| Charge $2,000+/year | "Verification shouldn't have a price tag." |
| Require platform accounts to verify | "Anyone should be able to check a badge. No login required." |
| Lock credential data in proprietary systems | "Your credentials should outlive any platform." |
| Use platform membership as trust signal | "Trust should come from your domain, not someone else's database." |
| Are sunsetting free tiers | "Free means free. Not free-for-now." |
| Don't offer self-hosting | "Run it on your infrastructure. Or use ours. Your call." |
| Ignore AI/agent integration | "Humans and AI agents use the same APIs." |

### The "premium = trustworthy" trap

Education professionals may think "free = not serious." Counter this by:

1. **The infrastructure analogy**: "Let's Encrypt is free. It secures 700 million websites. Free infrastructure isn't cheap infrastructure — it's public infrastructure."
2. **The open-source credibility signal**: "The code is open. Anyone can audit it. That's more trustworthy than a black box you pay for."
3. **The domain-ownership signal**: "Your trust comes from your domain — your reputation, your institution. We're just the plumbing."

## 3.4 The "Movement" Narrative

### The big story

The credentials market will reach $11.77 billion by 2034. Right now, it's fragmented across proprietary platforms that don't interoperate. Learners get locked into one issuer's ecosystem. Employers can't verify credentials across platforms. Small issuers (bootcamps, workshops, community programs) can't afford enterprise badge platforms.

**This is the HTTPS moment for credentials.**

In 2014, most websites didn't have encryption because it was expensive and hard. Let's Encrypt made it free and automatic. Within 5 years, HTTPS went from 40% to 80% of the web.

Open Badges have the standard. They have the format. What they don't have is a free, neutral, public trust layer. That's what Signet is. Not a platform that competes with Credly and Badgr — the infrastructure that makes *all* badge platforms more trustworthy.

**The movement tagline for community building:**

> "If it's not verifiable, it's not a credential."

This is the provocative version. It draws a line. It gives badge enthusiasts something to rally around. It makes people think about whether their current badges actually prove anything.

---

# 4. Design Language

## 4.1 Color Palette

### Recommendation: Evolve, don't replace

The current palette is well-structured with semantic meaning. The main issue is that it reads "developer tool" more than "education infrastructure." The fix is not to change the palette but to **add warmth** and **adjust the ratio** of how colors are used.

### Core palette (keep)

| Token | Value | Role |
|-------|-------|------|
| `--trust` | `#1d4ed8` | Primary action, links, CTAs |
| `--verify` | `#0f766e` | Success, verified state |
| `--warn` | `#d97706` | Caution, demo domain |
| `--risk` | `#dc2626` | Error, unverified |

### Background & surface (warm up)

| Token | Current | Proposed | Rationale |
|-------|---------|----------|-----------|
| `--paper` | `#f6f8fb` (cool blue-grey) | `#fafaf8` (warm off-white) | Adds warmth without losing professionalism. Education contexts benefit from paper-warm tones. |
| `--surface` | `#ffffff` | `#ffffff` | Keep pure white for cards |
| `--surface-sunken` | `#f1f4f9` | `#f5f5f2` | Warmer sunken surfaces |

### New: Accent warm color

| Token | Value | Role |
|-------|-------|------|
| `--accent` | `#6d5ced` (soft violet) | Secondary highlight, decorative elements, hover states on non-primary items. Adds a contemporary, forward-looking note without competing with semantic colors. |
| `--accent-light` | `#f4f2ff` | Light accent background for callouts |

### Why violet?

- Differentiated from every competitor (Credly is green, Badgr is blue, Accredible is purple-blue)
- Signals innovation and forward-thinking without being garish
- Pairs beautifully with trust-blue and verify-teal
- Works in both light and dark contexts
- Has energy — appropriate for a "movement" brand

### Semantic color usage ratios

The homepage should be approximately:
- 60% neutral (paper, surface, ink)
- 25% trust-blue (CTAs, links, primary actions)
- 10% accent-violet (decorative, secondary highlights)
- 5% verify-teal (success states, verified indicators)

Deeper pages (API, technical docs) shift toward more blue and less violet.

## 4.2 Typography

### Recommendation: Replace Boska. Keep Switzer.

**Boska** (display serif) has beautiful character but reads as editorial/literary — more "design magazine" than "trusted infrastructure." For a brand that wants to feel like public infrastructure for education, the display face needs more gravitas and warmth.

### Proposed display font: **Instrument Serif** (Google Fonts)

- Beautiful, contemporary serif with optical sophistication
- Reads as "modern institution" — trustworthy but not stuffy
- Excellent at large sizes (hero headlines)
- Free, open-source, widely available
- Pairs beautifully with Switzer's clean sans

**Alternative option**: **Playfair Display** (Google Fonts) — more classical authority, good for a "public utility" feel. Or **Fraunces** — warmer, quirkier, more approachable (the original choice from the earlier design plan).

### Proposed type stack

| Role | Font | Weight | Fallback |
|------|------|--------|----------|
| Display (h1, hero) | Instrument Serif | 400 (regular italic for emphasis) | Georgia, serif |
| Headings (h2-h4) | Switzer | 600 (semibold) | system-ui, sans-serif |
| Body | Switzer | 400 (regular) | system-ui, sans-serif |
| Code / API | JetBrains Mono or current mono | 400 | Consolas, monospace |
| Labels / Kickers | Switzer | 500, uppercase, tracked out | system-ui |

### Type scale (keep current)

The existing clamp-based responsive type scale is well-designed. Keep it.

```
--text-xs:   0.75rem
--text-sm:   0.84rem
--text-base: 0.95rem
--text-md:   1.05rem
--text-lg:   1.2rem
--text-xl:   clamp(1.7rem, 4vw, 2.5rem)
--text-hero: clamp(2.2rem, 5.3vw, 4rem)
```

## 4.3 Visual Motifs & Metaphors

### Primary metaphor: The Seal

A signet is a seal — a mark pressed into wax to prove authenticity. This metaphor should be visible but not literal.

**Visual expression:**
- The logo mark evolves from the current gradient circle into a **geometric seal** — a stylized circular emblem that suggests both a stamp/seal and a checkmark
- Not a literal wax seal (too old-fashioned) — more like a modern notary stamp or verification mark
- Think: the trust mark that appears next to verified issuers

### Secondary metaphor: The Ledger

The trust ledger is a record of verified domains. This suggests:
- **Structured information** — clean grids, tables, status rows
- **Transparency** — visible data, no hidden states
- **Accumulation** — trust builds over time as more issuers verify

### Visual motifs to use

1. **The verification ladder** — already on the site, keep and strengthen. A visual checklist that shows what passed and what didn't. This is the hero visual of the product.

2. **Domain → Seal** — Show the journey from a bare domain name to a verified, trusted issuer. This could be an animated sequence or a before/after visual.

3. **The open lock** — Not a padlock (that's Let's Encrypt's) but a shield with an open center, suggesting transparency. Or a seal that's been "opened" — you can inspect what's inside.

4. **Concentric rings** — Suggest rippling trust outward from a central domain. The issuer at the center, verification radiating outward to the world.

### Visual motifs to avoid

- Blockchain/crypto imagery (hexagonal networks, chains)
- Graduation caps and diplomas (too cliché for badge education)
- Generic "shield + checkmark" (overdone in security products)
- Abstract blobs (meaningless)
- Stock photos of diverse people in a classroom (every ed-tech site has these)

## 4.4 Illustration & Graphic Style

### Direction: Structured, not illustrated

This brand should feel like it was designed by an engineer with taste — not by an illustrator. Lean toward:

- **Diagrams over illustrations**: Show how things work, not abstract metaphors
- **Code as design element**: Actual JSON, actual API calls, actual curl commands — presented beautifully
- **Data visualization**: The trust ladder, verification results, domain status — these ARE the illustrations
- **Geometric patterns**: Clean, precise, mathematical. Trust is precise.

If illustrations are needed:
- **Style**: Flat, geometric, limited palette (trust-blue + accent-violet + ink + paper). Similar to Linear's illustration style — technical but with personality.
- **No characters/people**: This is infrastructure. The humans are the issuers and verifiers — we show their artifacts (badges, signatures, domains), not cartoon avatars.

## 4.5 Photography & Imagery Direction

### Recommendation: Avoid photography on the main site

Photography introduces a specific demographic, specific institution, specific context. For infrastructure that's meant to serve everyone, this creates exclusion problems.

**If photography is ever needed** (blog posts, case studies, social media):
- Real environments, not studios. Classrooms, offices, conferences, laptops.
- Candid, not posed. Show people *doing the work* — looking at screens, discussing credentials.
- Diverse without feeling curated. Education is global.
- Never show badges as literal physical objects. They're digital.

## 4.6 Logo / Wordmark Direction

### The wordmark: Signet

- Set in Instrument Serif (or chosen display serif), regular weight
- Generous letter-spacing (+0.02em)
- The 'S' could have a subtle custom treatment — a gentle curve that echoes a seal's edge
- No "by Firmament Works" in the primary mark. Clean.

### The logo mark: The Seal

Evolve the current gradient circle into a **geometric seal mark**:

- A circle with an inner geometric pattern suggesting verification/checking
- Could incorporate a subtle checkmark or key shape within the circle
- Two-color: trust-blue (`#1d4ed8`) to accent-violet (`#6d5ced`) gradient
- Works at small sizes (favicon, 16px) and large (hero, 120px+)
- The gradient direction should feel like movement — bottom-left to top-right (upward momentum)

### Lockup options

1. **Primary**: Seal mark + "Signet" wordmark (horizontal)
2. **Compact**: Seal mark only (for favicons, app icons, social avatars)
3. **Full**: Seal mark + "Signet" + "Trusted badges. Open proof." (for OG images, presentations)

## 4.7 Spatial / Layout Philosophy

### Principle: Generous but grounded

- **Wide margins**: 1120px max-width is good. Keep it. Content should breathe.
- **Vertical rhythm**: Sections should alternate between full-width and contained. The current alternating muted/plain pattern is good — keep it.
- **Cards don't float**: Cards should feel anchored to a grid, not scattered. 2-column and 3-column grids with consistent gutters.
- **Code blocks are first-class citizens**: They should be beautiful, not afterthoughts. Dark background, syntax highlighting, copy buttons. These are the "product screenshots" of an infrastructure brand.
- **Asymmetric layouts for hero sections**: The hero doesn't have to be centered text. Consider a split layout: compelling copy on the left, a live verification result on the right.

### Grid system

- **Base grid**: 12-column, 1120px max
- **Content width**: 820px for prose (issuer guide, about text)
- **Narrow width**: 640px for focused forms (verify input, demo badge)
- **Full width**: For hero sections and feature grids

### Whitespace as a signal

More whitespace = more confidence. Cramped layouts signal desperation. A site that gives content room to breathe signals "we don't need to shout." Let the quality of the content do the work.

## 4.8 Motion / Animation Philosophy

### Principle: Purposeful, not decorative

Animation should answer the question: "What just happened?" — not "Isn't this pretty?"

**Yes:**
- Scroll-triggered fade-in for content below the fold (current implementation is good)
- Verification result appearing with a brief expand + fade (shows that work happened)
- Status pill color transitions (pass → fail → demo states should feel meaningful)
- Copy button confirmation feedback (brief checkmark animation)
- Trust ladder rows appearing sequentially (suggests a checking process)

**No:**
- Parallax scrolling (distracting, accessibility concern)
- Continuous ambient animations (CPU drain, motion sensitivity)
- Hero text typewriter effects (cliché)
- Bouncing CTAs (desperate)
- Page transition animations (just load the page)

### Timing

- **Micro-interactions**: 150-200ms (button hovers, toggles)
- **Content reveals**: 300-400ms with ease-out
- **Page-level transitions**: 200ms max
- **Sequential reveals**: 80-120ms stagger between items

## 4.9 Iconography Direction

### Style: Outlined, geometric, 24px grid

- **Stroke weight**: 1.5px (matches Switzer's visual weight)
- **Line caps**: Round
- **Style**: Outlined, not filled. Filled icons feel heavy for an infrastructure brand.
- **Source**: Lucide icons (open-source, excellent quality, consistent style) or a custom subset

### Key icons needed

| Concept | Icon direction |
|---------|----------------|
| Verify | Checkmark in circle |
| Issue / Sign | Pen/signature stroke |
| Domain | Globe or link |
| Trust | Shield (outline, not filled) |
| API | Terminal/code brackets |
| Key | Key shape (literal) |
| Warning | Triangle with exclamation |
| Error | X in circle |
| Copy | Clipboard |
| External link | Arrow pointing up-right |
| Documentation | Book/page |

## 4.10 Component Personality

### Buttons

- **Primary**: Solid trust-blue, white text, generous padding (12px 28px), rounded corners (radius-sm: 10px). Confident without being aggressive.
- **Secondary**: Outlined with trust-blue border, trust-blue text. For secondary actions.
- **Ghost**: Text-only with subtle hover underline. For tertiary navigation.
- **On hover**: Deepen color (trust-deep), slight shadow lift. No dramatic transforms.
- **Personality**: Calm authority. "Click me because I'm the right next step" — not "CLICK ME NOW!!!"

### Cards

- **Surface**: Pure white on warm paper background
- **Border**: Subtle (1px `--line`), or shadow-only for lifted cards
- **Padding**: Generous (1.5rem+)
- **Hover**: Subtle lift (translateY(-2px)) with shadow-lifted. Current implementation is good.
- **Personality**: Each card is a contained idea. Clean, structured, complete.

### Forms

- **Input fields**: Subtle border, generous height (44px+), clear focus state (trust-blue outline)
- **Labels**: Above the field, semibold, small
- **Help text**: Below the field, muted, small
- **Error states**: Risk-red border + message below
- **Personality**: Inviting. "Type here. We'll handle the rest."

### Status pills / badges

- **Pass**: Verify-teal background with white text
- **Warn**: Warn-amber background with dark text
- **Fail**: Risk-red background with white text
- **Skip**: Muted grey background with dark text
- **Personality**: Definitive. These are verdicts, not suggestions.

### Code blocks

- **Background**: Dark (`--ink` or near-black)
- **Text**: Light, with syntax highlighting
- **Copy button**: Top-right, always visible
- **Language label**: Top-left
- **Personality**: "This is real. You can copy this and run it right now."

---

# 5. Page-by-Page Content Strategy

## 5.1 Homepage

### Emotion to evoke
**Clarity and momentum.** The visitor should feel: "I get it. This is exactly what we need. How do I start?"

### Primary user question it answers
"What is this, and why should I care?"

### Headline direction

**Hero:**
> Every badge should be provable.

**Sub-hero:**
> Free, open infrastructure for signing and verifying Open Badges. Prove who issued it. Check it in one click. No platform. No lock-in.

### Tone
Confident, mission-driven, warm. More TED talk than whitepaper.

### Key content blocks (in order)

1. **Hero**: Headline + subhead + two CTAs ("Verify a badge" primary, "Start issuing" secondary)
2. **The Problem** (3 cards or a single powerful statement):
   - "46% of employers don't know what to make of the credentials on a resume."
   - "Most badges are just images. There's no way to check if they're real."
   - "Badge platforms charge thousands of dollars and lock you into their ecosystem."
3. **How Signet Works** (3-step visual flow):
   - **Sign**: Issue badges signed with your domain's cryptographic key
   - **Verify**: Anyone checks trust status — public API, no account needed
   - **Trust**: Domain-bound verification builds portable reputation
4. **Live Demo / Try It**: An embedded verification widget or "Verify this demo badge now" CTA that shows a real verification result inline. *This is the moment that sells the product.*
5. **Who This Is For** (persona cards):
   - "Universities & training programs" — issue credentials employers can verify
   - "Employers & hiring teams" — check any badge in one click
   - "Learning platforms & bootcamps" — add trust without adding a vendor
   - "Developers & AI agents" — build verification into your stack
6. **The Trust Model** (brief, visual):
   - "Trust comes from your domain, not our platform"
   - Visual: domain → well-known file → signed badge → public verification
7. **The Let's Encrypt Moment** (manifesto section):
   - "Like HTTPS went from rare to universal, badge verification is about to become standard."
   - "We're building the free infrastructure to make it happen."
8. **Roadmap** (Now / Next / Later — keep current structure but with warmer labels)
9. **Footer CTA**: "Ready to issue? Set up in 15 minutes." → Issuer Setup Guide

### What to remove from the current homepage
- "Open Trust Infrastructure" kicker (too cold)
- Deep technical terminology (Ed25519 etc.)
- Jargon headers ("How issuer identity works" — rewrite as "Your domain is your identity")

## 5.2 Verify Page

### Emotion to evoke
**Empowerment and transparency.** The visitor should feel: "I can check anything. The answer is clear."

### Primary user question it answers
"Is this badge real? Who issued it?"

### Headline direction
> Check any badge. Right now.

### Tone
Tool-focused, efficient, reassuring. Like a good search engine — the interface gets out of the way.

### Key content blocks

1. **Minimal hero**: Headline + one-line subhead. Don't compete with the tool.
2. **The verification tool** (keep current tab structure: URL / JSON / Issuer)
3. **Trust state legend** (keep right sidebar, but simplify language):
   - Green: "Verified — signed by a confirmed domain"
   - Amber: "Demo — valid signature, test domain"
   - Red: "Unverified — cannot confirm the signer"
4. **Quick examples** (keep, but add descriptive labels)
5. **Result display**: Keep the verification ladder. It's the best design element on the site.
6. **Prompt-to-badge demo** (keep as second tab, but rename to "Create a test badge")
7. **Callout cards** for API and Issuer Setup (keep, good cross-selling)

### What to improve
- The caveat banner should feel like a transparency feature, not a disclaimer. Frame it as: "What this tells you — and what it doesn't."
- The demo tab should explain in plain English why it shows "DEMO" — "We use example.com so you can experiment without setting up your own domain."

## 5.3 API Page

### Emotion to evoke
**Competence and respect.** The developer should feel: "These people know what they're doing. I can build on this."

### Primary user question it answers
"How do I integrate badge verification or issuance into my system?"

### Headline direction
> Build on open trust.

### Tone
Precise, scannable, zero fluff. Every word earns its place. Code speaks louder than copy.

### Key content blocks

1. **Dark hero** (keep current dark treatment — it signals "developer territory")
2. **Two-section structure**: "Public (no key)" and "Authenticated (API key)"
3. **Quickstart** (condensed to 4 steps with runnable curl commands)
4. **Endpoint reference** (keep current grid, clean and scannable)
5. **Agent-native callout**: "Humans and AI use the same API. See llms.txt or connect via MCP."
6. **Implementation specifics** (SSRF protection, rate limiting, domain trust model)

### What to improve
- Add a "Try it live" interactive section where you can paste a URL and see the response right on the API page
- Response schemas should be shown alongside endpoints (currently they're separate)
- The distinction between public and authenticated routes is the site's best architectural feature — make it even more visually prominent

## 5.4 Issuer Setup Page

### Emotion to evoke
**Achievability.** The reader should feel: "I can actually do this. It's not as hard as I thought."

### Primary user question it answers
"How do I start issuing verified badges from my own domain?"

### Headline direction
> Start issuing trusted badges in 15 minutes.

### Tone
Instructional, patient, encouraging. Workshop-facilitator energy. Each step has a clear "you'll know it worked when..." confirmation.

### Key content blocks

1. **Hero**: Headline + reassurance ("No vendor. No contract. No permission needed.")
2. **Prerequisites check**: "You need: a domain you control, HTTPS, and the ability to upload a file."
3. **Step-by-step flow** (keep current 5-step structure, but add success indicators):
   - Step 1: Generate keys → "You'll see three files in your directory"
   - Step 2: Host the profile → "Visit the URL — you should see your JSON"
   - Step 3: Verify your domain → "You'll get `DOMAIN_VERIFIED_SIGNATURE` in the response"
   - Step 4: Issue and sign → "The output is a portable JSON file"
   - Step 5: Share and verify → "Send anyone this link — they'll see the verification result"
4. **"What verified means" section** (keep, but simplify language)
5. **Troubleshooting FAQ**: Common issues (CORS, file not found, wrong content-type)
6. **CTA**: "Not ready yet? Try the demo badge first."

---

# 6. Key Design Principles

These five principles should guide every design and content decision for Signet.

## Principle 1: Show the Proof

> Never just claim something works — demonstrate it.

Every page should have a moment where the visitor sees the product in action. The verification result is the product. Show it early, show it often, show it real. If a feature can be demonstrated live, demonstrate it live.

*Applied: The homepage should have an interactive verification widget, not a screenshot of one.*

## Principle 2: Trust Through Transparency

> We earn trust by showing exactly what we do and what we don't.

The caveat language ("verifies domain/key control, not assessment quality") is not a weakness — it's the brand's strongest trust signal. Honesty about scope is how infrastructure earns lasting confidence. Never overstate. Never hide limitations.

*Applied: Every verification result shows exactly what was checked, what passed, and what the result means.*

## Principle 3: Infrastructure Disappears

> The best infrastructure is invisible. The user thinks about their badge, not our platform.

Signet should feel like plumbing — essential, reliable, not attention-seeking. The brand should be present enough to be credited but restrained enough to stay out of the way. This means: no splash screens, no onboarding wizards, no gamification, no engagement metrics. You come, you verify, you leave. That's a feature.

*Applied: The verification page loads instantly, works without an account, and puts the result front and center.*

## Principle 4: Education First, Technical Second

> Lead with the outcome for learners and institutions. The cryptography is an implementation detail.

The homepage headline should make sense to a continuing education director, not a cryptography engineer. Technical depth is available — in the API docs, in the trust model spec, in the CLI reference — but it's never the front door.

*Applied: "Your domain is your identity" before "Ed25519 domain-bound signature verification."*

## Principle 5: Free Means Free

> No asterisks. No "free tier." No bait-and-switch.

In a market where Badgr just killed its free tier and Credly won't even publish pricing, being genuinely, permanently free is a radical act. This should be stated plainly and proudly, not hedged or buried. The business model is public infrastructure — like Let's Encrypt, the value is in the ecosystem, not the subscription.

*Applied: The word "free" appears on the homepage. It's not in small print. It's not followed by "for now."*

---

# Appendix A: Competitive Brand Audit Summary

| Brand | Voice | Visual | Weakness we exploit |
|-------|-------|--------|-------------------|
| **Credly** (Pearson) | Corporate, authoritative, enterprise | Dark blue, data-heavy, dashboards | Expensive, opaque pricing, lock-in |
| **Badgr/Parchment** | Academic, utilitarian, "pathway" language | Blue-green, LMS-integrated, dated | Sunsetting free tier, acquisition chaos |
| **Accredible** | Polished, customization-focused | Purple-blue, white-label emphasis | Platform-dependent verification |
| **Certifier** | SaaS-friendly, templates-first | Light, modern, widget-heavy | Not standards-focused, surface-level |
| **Open Badge Factory** | Institutional, EU-government tone | Functional, minimal design effort | No consumer appeal, dry |

**Signet's white space**: None of these brands are mission-driven. None frame themselves as public infrastructure. None lead with verification. None are free and open-source. None integrate with AI agents. We occupy an entirely uncontested position.

---

# Appendix B: Words We Own

These are phrases and terms that should become synonymous with Signet through consistent repetition:

- **"Domain-verified"** — our trust state, our term
- **"Open proof"** — from the tagline, meaning proof anyone can check
- **"Badge trust"** — the concept we're building, the gap in the market
- **"The trust layer"** — what we are in the stack
- **"One-click verify"** — the user experience we promise
- **"Your domain, your trust"** — the value proposition in six words
- **"If it's not verifiable, it's not a credential"** — the provocative stance

---

# Appendix C: Sample Social Copy

### Launch / announcement

> Most digital badges can't be verified. You just... trust them?
>
> We built Signet — free, open infrastructure that lets anyone check if a badge is real. One click. No account. No platform lock-in.
>
> It's like Let's Encrypt, but for credentials.
>
> → badges.firmament.works

### For education professionals

> Your students earn badges. Employers see them on a resume. But can they verify them?
>
> With Signet, any badge signed with your domain can be checked by anyone, instantly. Free.
>
> Set up in 15 minutes. No vendor. No contract. →

### Provocative / thought leadership

> 46% of employers don't know what to make of non-degree credentials on a resume.
>
> The problem isn't badges. The problem is verification.
>
> When credentials are independently verifiable, they stop being decoration and start being proof.

### For developers

> Public badge verification API. No auth required.
>
> `curl badges.firmament.works/public/api/verify/badge/{url}`
>
> Returns trust state, issuer domain, key fingerprint, signature status.
>
> Free. Open. SSRF-hardened. llms.txt included.
