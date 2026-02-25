# Revised Plan: Domain-Bound Trust + Prompt-to-Badge Growth Loop

## Summary
This revised plan makes your trust model explicit and simple:

1. `UNVERIFIED`
- Badge is unsigned or signature/domain/key cannot be verified.

2. `DOMAIN_VERIFIED_SIGNATURE`
- Badge signature is valid and key is currently discoverable for issuer domain.

Trust is tied to domain/key control, not platform authority or assessment rigor.
Growth strategy shifts to a Step 0 "Prompt-to-Badge" loop for organic adoption by badge enthusiasts.

## Core Product Thesis (Locked)
1. Anyone can become an issuer by controlling a domain/subdomain and publishing well-known issuer metadata.
2. Anyone can verify badges manually or programmatically through open public endpoints.
3. Verifier should prove "who signed this" (domain-bound), not "how good the assessment was."
4. Reputation/quality of badge criteria is issuer policy and ecosystem interpretation.

## Step 0: Enthusiast Activation (new first milestone)
### Goal
Create viral, replayable proof of value without outbound sales.

### Deliverables
1. Prompt-to-Badge demo flow:
- input: "I read this paper, assess me and issue a badge"
- output: generated skills + assessment + signed badge + verify permalink

2. Share-ready challenge page:
- "Verify this badge yourself in under 60 seconds"
- includes valid and intentionally invalid sample

3. OG launch kit:
- 3 short post templates
- one demo script
- one canonical verify link per run

4. Viral conversion path:
- challenge -> generate keys -> publish well-known -> verify domain -> issue first badge

### Activation KPI (primary)
- `new_verified_domains` (unique domains reaching domain-verified state)

### Supporting KPIs
- `verify_challenge_completions`
- `verify_result_share_clicks`
- `% verified domains issuing first signed badge within 7 days`

## Trust + Identity Model (updated)
### Canonical issuer identity in verifier
- `issued by <domain>` (canonical)
- `claimed name: <issuer profile name>` (non-canonical claim)
- TLS certificate org/CN shown only as optional metadata, clearly marked non-canonical

### Required verifier copy
1. For `DOMAIN_VERIFIED_SIGNATURE`:
- "Signed by verified domain: `<domain>`"
- "Signature is valid and key is currently discoverable for this domain."

2. For `UNVERIFIED`:
- "Issuer cannot be cryptographically verified."

3. Universal caveat:
- "This verifies domain/key control. It does not certify assessment quality or accreditation."

## API and Interface Changes
### Public APIs
1. Keep existing:
- `POST /public/api/issuers/verify`
- `GET /public/api/verify/badge/:badgeUrl(*)`
- `GET /public/api/verify/issuer/:issuerUrl(*)`
- `POST /public/api/verify/json`

2. Add trust discovery APIs:
- `GET /public/api/trust/issuer/:domain`
- `GET /public/api/trust/events/:domain`
- `GET /public/api/trust/issuers?status=...`

### Response contract additions
- `trustState`: `UNVERIFIED | DOMAIN_VERIFIED_SIGNATURE`
- `issuerDomain`
- `keyFingerprint`
- `verificationReason`
- `issuerClaimedName`

### CLI / MCP
1. CLI:
- `verify` shows trust state + domain + fingerprint
- `onboard-issuer` guided command for non-technical setup
- keep `--log-trust` semantics explicit

2. MCP:
- explicit onboarding + prompt-to-badge tools:
- `generate_issuer_profile_template`
- `verify_issuer_domain`
- `issue_sample_badge`
- `explain_verification_result`
- keep public verify tools no-key by default

## Prompt-to-Badge Product Surface
### v1 (fast path)
1. User provides source text/link and intent.
2. Assistant generates:
- skill list
- badge name/description
- assessment questions
3. User answers questions.
4. Assistant computes score/proficiency and creates badge payload.
5. Badge is signed (local or server mode) and returns:
- badge URL
- verify URL
- share snippet

### Metadata fields to include
- `assessment_mode` (`self`, `ai_assisted`, `external`)
- `assessment_summary`
- optional evidence links/transcript hash (optional in v1 for speed)

## Security + Cost Constraints (Railway)
### Security controls
1. Maintain SSRF protections and private network blocking.
2. Rate-limit all public trust-write and expensive verification paths.
3. Add request size limits and strict JSON parsing.
4. Add abuse guardrails:
- per-IP quotas
- per-domain cooldown for repeated trust writes

### Cost controls
1. Instrument:
- external fetch count
- trust-write requests
- verification request volume
- cache hit rate
2. Enforce runtime caps:
- fetch timeouts
- concurrent verifier jobs
- retry ceilings
3. Budget thresholds:
- alert at `$20`, `$50`, `$100` monthly

## Website / Messaging Changes
### Homepage
1. Lead with:
- self-custodied keys
- domain-bound signing trust
- open public verification
2. Add "Try prompt-to-badge demo" CTA above fold.

### Verify page
1. Show issuer block first:
- signed by domain
- claimed issuer name
- trust state badge
2. Include explicit caveat on assessment rigor.

### Vision page
1. Explicitly state:
- now: domain/key trust
- later: vouching/circles-of-trust for higher-order reputation

### API page
1. Separate "Public verify/trust APIs" from "Authenticated issuance APIs."
2. Include one full no-key verification example and one trust-write example.

## Testing and Acceptance Criteria
### Functional
1. Signed valid badge from verified domain returns `DOMAIN_VERIFIED_SIGNATURE`.
2. Unsigned/invalid/mismatch returns `UNVERIFIED`.
3. Verifier always displays canonical issuer as domain.

### UX/content
1. Verifier copy uses locked phrases and caveats exactly.
2. Prompt-to-badge demo completes in <= 2 minutes for first-time user.
3. Share link reproducibly renders same verification outcome.

### Security
1. SSRF tests pass for blocked/private/local targets.
2. Public trust-write endpoints enforce rate limits with clear retry metadata.
3. Abuse scenarios do not escalate infrastructure cost unexpectedly.

### Growth
1. Step 0 launch can produce at least 3 shareable demo links.
2. Track and report `new_verified_domains` daily.
3. 7-day conversion from verify challenge to first verified domain is measurable.

## Rollout Sequence
1. Week 1: Step 0 demo + share links + instrumentation.
2. Week 2: verifier identity/trust-state UI + copy hardening.
3. Week 3-4: trust discovery APIs + CLI/MCP parity.
4. Week 5-6: onboarding wizard + non-technical docs.
5. Week 7: security/cost tuning and ops runbook.

## Assumptions and Defaults
1. No centralized accreditation layer in scope for this phase.
2. Trust state remains two-state model only (`UNVERIFIED`, `DOMAIN_VERIFIED_SIGNATURE`).
3. Assessment evidence remains optional in v1 (speed-first growth).
4. Domain reputation and later vouching handle higher-order trust differentiation.
5. Railway remains deployment platform and budget cap is `$100/month`.
