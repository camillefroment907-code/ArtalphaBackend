# Nautilus 2.0 — Product charter and release gates
Date: 2026-10-25
Status: Working proposal — NOT legal clearance or authorization to deploy.
Branch: audit/nautilus-legal-v2

## Product decision
Nautilus helps French art-auction buyers discover art, understand auction mechanics and costs, save their own selections, and prepare bids. Nautilus does not run auctions, place bids, hold funds, guarantee authenticity or returns, or claim a lot is objectively undervalued.

## Phase 0: security and provenance (blocking)
- Production is reportedly offline: Railway and Supabase subscriptions were canceled. Do not assume any running background worker or active database.
- PUBLIC REPOSITORY RISK: tracked SQL backups at backup_artalpha_20260327_1036.sql and ArtAlpha/backup_artalpha_20260327_1036.sql. Do not open or duplicate their contents. Determine exposure, preserve evidence privately, assess personal-data breach, remove from current tree AND Git history using a controlled process, rotate any exposed credentials, evaluate CNIL notification obligations with qualified counsel.
- Inventory every source, its agreement, permitted display, photos, AI processing, retention, alerts and sublicensing. Default DENY. API accessibility is not a license.
- Existing Drouot/Interencheres Playwright scrapers, third-party JSON endpoints, Apify actors and legacy datasets are UNAPPROVED until verified; do not enable or ship them.
- Existing marketing claims, generated testimonials, estimated member counts and deal scores require factual review.

## Phase 1: zero-unlicensed-data MVP
- Static-first React/Vite frontend; deploy preview only after security review.
- Artistic taste quiz: categories, style, budget, preferred periods; locally stored until compliant auth/storage exists.
- Auction fee calculator: user enters hammer price, buyer premium, taxes and shipping; show transparent assumptions and never silently invent rates.
- Educational content and bidding checklist, curated original or correctly licensed text/images.
- Personal saved items entered manually by users; no automatic retrieval of third-party page content, photos or bulk imports.
- No payment, paid tier, AI external calls, marketing emails, or third-party analytics until specific controls are complete.
- Clear empty states: no fake auctions, no fake reviews, no fabricated market metrics.

## Phase 2: rights-cleared catalog feed
- Contract with at least one auction house or licensed supplier.
- Each record: source_id, contract_id, attribution, source_url, permitted_fields, image_rights, permitted_uses, expiry, deletion/refresh SLA, AI_processing_allowed, audit timestamp.
- Server-side authorization gate before ingest, indexing, personalization, emailing and display; fail closed when rights are missing or expired.
- Links redirect to official auction house for bids and transactions.

## Release gates
1. Security: no public database backups/secrets; tested auth and authorization, rate limits, monitoring, backups.
2. Rights: contracts and per-source provenance validated by qualified French counsel.
3. Privacy: lawful basis, retention, privacy notice, processor contracts, rights handling, cookie compliance.
4. Consumer: terms, commercial disclosures, refund/withdrawal rules if applicable, legal notices.
5. Quality: automated tests, accessibility, mobile, performance, error handling.
6. Operations: monitoring, owner for incidents, revocation switch for each data source, rollback plan.
7. Growth: measured signups and retention; 500 in 90 days is a target, not a guarantee.

## Implementation sequencing
A. Audit existing routes/components and deployment files.
B. Build self-contained MVP pages with no backend dependency.
C. Run build, tests and accessibility checks.
D. Preview and review with user.
E. Lawyer review and contracts before any third-party auction feed or commercial launch.

## Operating constraints
- No production edits, billing reactivation, user data processing or deployment without explicit approval.
- Never assert 100% legal compliance without case-specific professional validation.
