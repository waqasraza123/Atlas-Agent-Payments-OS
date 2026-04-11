# Phase 1 Demo Foundation Detailed

## Goal

Make Atlas sell itself through a polished narrative and realistic seeded product demo while still building on real domain structures.

## Why This Phase Exists

Atlas needs a premium product story early, but the demo should still be anchored to real entities, real seeded records, and the actual lifecycle model.

## Entry Criteria

- Phase 0 exit criteria met
- actor-aware product shells exist
- richer seeded state exists

## Current Status

Phase 1.1 through 1.5 now have a baseline in repo scope through a stronger marketing narrative, more polished buyer, seller, and operator overview dashboards, and seeded request and approval detail surfaces with timeline-first presentation. The next active step is Phase 1.6 demo-mode polish, followed by Phase 2 buyer workflow implementation.

## Exit Criteria

- public marketing site is polished and category-clear
- buyer, seller, and operator overviews are attractive and believable
- seeded demo flow exists end to end visually
- timeline and dashboard storytelling work

## Detailed Sub-Steps

### Phase 1.1 — public narrative hardening

- refine hero and value proposition
- add how-it-works sequence
- add trust pillars, use cases, and controlled-autonomy framing
- add visual showcase sections grounded in real product surfaces

### Phase 1.2 — buyer dashboard showcase

- seeded metrics for spend, pending approvals, top agents, top sellers, and exceptions
- dashboard cards that explain the control plane clearly
- recent request and activity surfaces backed by real seed records

### Phase 1.3 — seller dashboard showcase

- service performance, customer usage, request activity, and revenue summaries
- seller surfaces that feel modern and operational rather than developer-console-like

### Phase 1.4 — operator showcase

- platform metrics, exception tiles, delayed confirmations, and audit overview
- cross-entity views that feel credible for support and risk workflows

### Phase 1.5 — timeline and detail experience

- request detail page
- approval detail presentation
- payment lifecycle detail
- receipt preview surfaces
- timeline-first storytelling across seeded lifecycle states

### Phase 1.6 — demo-mode polish

- seeded scenarios feel coherent and replayable
- empty, loading, and error states are polished
- data density, motion, and visual hierarchy are refined

## Modules Touched

- `apps/web`
- `packages/ui`
- `packages/domain`
- `packages/database`
- `docs`

## Deliverables

- polished marketing surface
- demo-ready buyer, seller, and operator dashboards
- signature Atlas detail views for approvals, timelines, and receipts

## Focused V1 Track Boundary

This phase is part of the focused v1 track because it makes the wedge legible and demoable. It should remain grounded in real domain entities rather than becoming a detached marketing prototype.

## Full-Scale Platform Maturity Follow-Ons

Later tracks may add:

- customer-facing onboarding flows
- richer environment-specific demo controls
- external API and developer storytelling

## Deferred

- real write flows beyond what Phase 2 requires
- production seller webhooks
- enterprise onboarding programs
- broad support tooling

## Verification Commands

- `pnpm build`
- `pnpm dev:web`
- manual walkthrough of marketing, buyer, seller, and operator seeded views

## Acceptance Criteria

- a founder or client can understand Atlas in one guided session
- the seeded product feels premium and credible
