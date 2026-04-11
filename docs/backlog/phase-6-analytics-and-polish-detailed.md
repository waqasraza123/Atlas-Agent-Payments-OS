# Phase 6 Analytics and Polish Detailed

## Goal

Make Atlas boardroom-ready, design-partner-ready, and visually complete.

## Why This Phase Exists

Once the core lifecycle works and operators can investigate it, the platform needs meaningful reporting, strong discoverability, and enterprise-grade UX quality.

## Entry Criteria

- operator workflows exist

## Exit Criteria

- analytics are meaningful
- exports are useful
- search and filtering are strong
- UX polish is enterprise-grade

## Detailed Sub-Steps

### Phase 6.1 — buyer analytics

- spend over time
- spend by agent
- spend by seller
- spend by service
- auto-approved versus manual-approved
- approval turnaround time
- exception rate and budget utilization

### Phase 6.2 — seller analytics

- revenue over time
- usage by buyer
- top services
- success versus failure
- payout status and repeat buyers

### Phase 6.3 — platform analytics

- active organizations
- request and approval volume
- payment success and exception rate
- request-to-completion timing

### Phase 6.4 — export and reporting flows

- CSV export
- receipt export preparation
- audit bundle export preparation

### Phase 6.5 — advanced search and filtering

- multi-entity filters
- risk markers
- amount and date filters
- saved filter design if grounded by actual user flow

### Phase 6.6 — accessibility and performance refinement

- keyboard flows
- readable empty, loading, and error states
- responsive dense-data behavior
- performance refinement for heavy tables and detail screens

## Modules Touched

- `apps/web`
- `apps/api`
- `apps/worker`
- `packages/database`

## Deliverables

- buyer, seller, and platform analytics
- export-ready reporting surfaces
- stronger multi-entity search and filtering
- refined enterprise-grade UX

## Focused V1 Track Boundary

This phase closes the focused v1 track for an enterprise-credible narrow wedge. It strengthens reporting, discoverability, and UX without changing the wedge.

## Full-Scale Platform Maturity Follow-Ons

Later tracks may add:

- deeper BI and reporting integration
- customer-configurable dashboards
- broader admin and governance analytics
- higher-scale search infrastructure if needed

## Verification Commands

- `pnpm build`
- analytics and export smoke tests

## Acceptance Criteria

- Atlas feels like an enterprise-grade product with meaningful reporting and polished data-heavy UX
