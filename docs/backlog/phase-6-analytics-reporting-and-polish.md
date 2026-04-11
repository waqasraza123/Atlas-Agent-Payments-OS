# Phase 6 Analytics, Reporting, and Polish

This file is a summary companion. The authoritative implementation guide is [phase-6-analytics-and-polish-detailed.md](./phase-6-analytics-and-polish-detailed.md).

## Goal

Make Atlas design-partner-ready by strengthening analytics, reporting, discoverability, dense-data UX, and accessibility.

## Dependencies

- Phase 5 complete
- payment, receipt, and operator data stable

## Workstreams

### 1. Buyer analytics

- Build spend over time, spend by agent, spend by seller, auto-approved versus manual-approved, exception rate, and budget utilization views.
- Keep aggregations explainable and anchored to stored event or transaction records.

### 2. Seller analytics

- Build revenue over time, service usage, success rate, customer concentration, and settlement visibility views.

### 3. Platform analytics

- Build operator-level metrics for active organizations, active agents, requests processed, approvals routed, payment success rate, and resolution time.

### 4. Reporting and export

- Add CSV export for key tables.
- Add audit bundle export and receipt packet export preparation.
- Keep export generation asynchronous through worker jobs.

### 5. Search, filters, and dense-data polish

- Add saved filters, stronger multi-entity search, and table/detail ergonomics.
- Improve keyboard access, focus states, and readability.
- Tighten empty, loading, and error states across all major surfaces.

## Technical deliverables

- analytics queries or projection jobs
- export job contracts and artifact storage
- improved cross-entity search API shape
- accessibility passes across navigation, drawers, tables, and forms

## Acceptance criteria

- buyer, seller, and operator dashboards have trustworthy summary analytics
- exports can be generated without blocking the request path
- high-volume list views remain usable
- accessibility and keyboard flows meet the product standard
