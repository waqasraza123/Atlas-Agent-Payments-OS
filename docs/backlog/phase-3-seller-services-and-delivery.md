# Phase 3 Seller Services and Delivery

## Goal

Make Atlas a credible two-sided platform by letting sellers publish paid digital services and respond to buyer requests in a structured way.

## Dependencies

- Phase 2 complete
- buyer-side requests and approvals operational

## Workstreams

### 1. Seller onboarding

- Build seller organization profile, team roles, service ownership, and support contact settings.
- Add seller-specific auth gating inside the single web app.

### 2. Service management

- Build service create, edit, publish, unpublish, and archive flows.
- Support an initial fixed-price model with room for usage-based pricing later.
- Store service category, description, delivery expectations, trust metadata, and pricing.

### 3. Buyer to seller linkage

- Link spend requests to seller organizations and services.
- Ensure request detail shows buyer, seller, service, amount, approval state, and delivery status clearly.
- Keep seller visibility scoped to its own requests and services.

### 4. Delivery lifecycle

- Let seller operators mark a request as fulfilled or failed.
- Capture fulfillment metadata and external reference where applicable.
- Add worker jobs for delayed delivery checks and seller webhook retries.

### 5. Seller dashboard

- Build revenue, request, customer, and service performance summary views.
- Add request history and service activity detail screens.

## Technical deliverables

- API modules for sellers, services, and delivery outcomes
- schema additions for service catalog and delivery metadata
- seller route group pages for overview, services, requests, payments placeholder, settings
- webhook registration model and delivery log baseline
- worker job contracts for seller delivery checks

## Acceptance criteria

- a seller can publish at least one payable service
- a buyer request can target a published service
- the seller can report fulfillment outcome with metadata
- request detail views reflect seller delivery state on both sides
- service history is visible and filterable
