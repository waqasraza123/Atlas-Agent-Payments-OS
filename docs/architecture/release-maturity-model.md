# Release Maturity Model

## Purpose

This document defines the release stages Atlas should move through and the go or no-go expectations for each stage.

## Internal Concept Demo

### Product readiness

- coherent product story
- seeded walkthrough
- premium visual baseline

### Platform readiness

- local development works
- schema and seeds are usable

### Ops readiness

- basic boot and verification path exists

### Security readiness

- no real customer deployment assumptions

### Docs readiness

- product and execution docs exist

### Go or no-go gate

- proceed only if the demo is coherent and the repo can be built on safely

## Functional Alpha

### Product readiness

- real actor-aware application baseline
- first real request and approval workflow foundations

### Platform readiness

- domain module boundaries exist
- repeatable local and shared dev setup exists
- release verification script and CI release gate exist
- environment templates and release manifests are validated

### Ops readiness

- queue conventions and basic logging exist

### Security readiness

- actor attribution and tenant-aware thinking exist
- signed session handling exists for app and support paths

### Docs readiness

- active phase docs and runbooks are current

### Go or no-go gate

- proceed only if the app is no longer placeholder-driven

## Design Partner Pilot

### Product readiness

- buyer, seller, payment, and receipt wedge is working for the narrow use case
- operator exception baseline exists

### Platform readiness

- seeded and real test scenarios are coherent
- payment evidence and receipt flows exist

### Ops readiness

- incidents can be detected
- backups and restore planning exist
- release and rollback basics exist
- repo-owned backup and restore commands exist

### Security readiness

- role and tenant guardrails are materially real
- support access is constrained, read-only where required, and reviewable at runtime

### Docs readiness

- runbooks and release notes are usable by the team

### Go or no-go gate

- proceed only if the narrow wedge can be operated safely with design partners

## Private Beta

### Product readiness

- focused v1 wedge is functionally credible

### Platform readiness

- environment discipline is stronger
- migrations and releases are controlled
- promotion manifests and environment progression are enforced
- release artifacts and digests are attached to promotion output

### Ops readiness

- alerting, backup, rollback, and support workflows exist
- restore-drill verification exists in repo-owned release checks

### Security readiness

- internal access controls and seller/payment trust boundaries are stronger
- support-access issuance, review, activation, recertification, revoke controls, and review campaigns are bounded and auditable

### Docs readiness

- support, release, and escalation docs exist

### Go or no-go gate

- proceed only if the product can be operated without relying on heroics

## Public Beta

### Product readiness

- core wedge is stable for broader external evaluation

### Platform readiness

- release quality is more predictable
- environment management is disciplined

### Ops readiness

- ownership and alerting are explicit
- key failure paths are recoverable
- restore drills are rehearsed outside local-only development

### Security readiness

- broader rollout risks are reviewed and acceptable
- analytics, export, and support inspection paths stay tenant-scoped under support and provider-backed sessions

### Docs readiness

- external-facing onboarding and help content exist

### Go or no-go gate

- proceed only if broader user exposure does not outpace the support model

## GA

### Product readiness

- focused v1 wedge is complete for intended scope

### Platform readiness

- production-grade deployment and data handling baseline exist
- promotion, rollback, and restore procedures are runnable and current

### Ops readiness

- release, rollback, incidents, and restore are all operationally credible

### Security readiness

- auth, authorization, tenancy, audit, and secret handling meet the target customer bar
- internal support access does not bypass tenant controls
- external identity-provider exchange and persisted Atlas session brokering are operationally credible

### Docs readiness

- customer-facing and internal docs are current

### Go or no-go gate

- proceed only if the focused v1 can be sold and run responsibly

## Enterprise Rollout

### Product readiness

- governance and support depth match enterprise expectations

### Platform readiness

- stronger environment and integration maturity exist

### Ops readiness

- support model, incident handling, and exportability are enterprise-safe

### Security readiness

- enterprise auth and trust expectations are materially addressed

### Docs readiness

- enterprise onboarding, support, and trust materials exist

### Go or no-go gate

- proceed only if the product, platform, and operational model can support enterprise scrutiny
