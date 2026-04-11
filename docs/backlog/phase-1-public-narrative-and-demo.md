# Phase 1 Public Narrative and Demo

This file is a summary companion. The authoritative implementation guide is [phase-1-demo-foundation-detailed.md](./phase-1-demo-foundation-detailed.md).

## Goal

Make Atlas immediately understandable and impressive before the full functional platform is complete. This phase builds the public story, the premium visual direction, and the seeded demo system using real domain entities.

## Dependencies

- Phase 0 complete
- shared UI primitives stable
- auth and seeded demo records available

## Workstreams

### 1. Marketing surface

- Build a premium landing page in the `(marketing)` route group.
- Add hero, product framing, buyer and seller value, control story, workflow strip, and CTA sections.
- Use the real Atlas visual system from `@atlas/ui`, not a separate marketing theme.

### 2. Demo data strategy

- Extend seed data to include at least one buyer org, one seller org, one operator org, multiple agents, multiple services, two policies, one pending approval, one successful request, and one failure scenario.
- Keep every demo record valid within the same schema used by later phases.
- Add scenario identifiers so the worker can replay deterministic timeline events later.

### 3. Buyer, seller, and operator showcase shells

- Build premium dashboards with realistic KPI blocks, recent activity, key cards, timeline previews, and drill-in detail surfaces.
- Use seeded records, not mocked frontend JSON.
- Add route-level detail pages for one agent, one request, one service, one payment, and one receipt showcase.

### 4. Narrative-rich UI moments

- Design a premium approval card.
- Design a cinematic request timeline detail view.
- Design a polished receipt detail surface.
- Design a seller service gallery layout.

### 5. Demo reliability

- Add a deterministic demo replay path for UI progressions that later phases can reuse.
- Keep replay state in the worker or server-side seed orchestration, not in client-only timers.

## Technical deliverables

- marketing route sections and CTA blocks
- seeded premium dashboards for buyer, seller, and operator
- reusable approval card, timeline, and receipt primitives
- demo scenario identifiers and replay hooks
- documented visual direction and content hierarchy

## Acceptance criteria

- a new viewer can understand the category within one landing-page session
- the product shell looks premium and coherent across all route groups
- the demo story can show request creation, policy evaluation, approval, payment, receipt, and audit progression with seeded data
- no demo screen depends on throwaway fake state outside the real data model
