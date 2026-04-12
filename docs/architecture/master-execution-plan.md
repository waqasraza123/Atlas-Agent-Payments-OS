# Master Execution Plan

## Purpose

This document is the execution-side source of truth for Atlas Agent Payments OS. It preserves the focused v1 build order while also defining the parallel platform, operations, security, and full-scale expansion tracks required for a real production rollout.

## Source Of Truth Stack

- Product source of truth: [master-product-spec.md](../product/master-product-spec.md)
- Execution source of truth: [master-execution-plan.md](./master-execution-plan.md)
- Full-scale end-state blueprint: [full-scale-product-blueprint.md](./full-scale-product-blueprint.md)
- Production operations blueprint: [production-operations-blueprint.md](./production-operations-blueprint.md)
- Security and compliance roadmap: [security-and-compliance-roadmap.md](./security-and-compliance-roadmap.md)
- Release maturity model: [release-maturity-model.md](./release-maturity-model.md)
- Durable repo memory: [project-state.md](../project-state.md)
- Local handoff memory: `docs/_local/current-session.md`
- Execution workflow: [codex-execution-runbook.md](../codex-execution-runbook.md)

## Current Repository Baseline

- The monorepo scaffold, governance docs, safe push workflow, and local infra definitions already exist.
- `apps/web`, `apps/api`, `apps/worker`, and the shared packages now form a real Phase 0 application baseline.
- Prisma schema, initial migration, and a scenario-driven seed path already exist.
- Phase 0 implementation is now complete in repo scope.
- Phase 1 premium demo foundation is complete in repo scope.
- Phase 2 core buyer workflow is complete in repo scope.
- Phase 3 seller workflow is complete in repo scope through seller catalog management, seller fulfillment recording, and seller analytics summaries.
- Phase 4 payment rail abstraction, internal simulated settlement, Stripe baseline, retry lifecycle hardening, richer receipt evidence, and broader reconciliation views are now in place in repo scope.
- Phase 5 operator controls and exceptions are now in place in repo scope through operator case modeling, persistent notifications, reason-captured actions, and a filterable audit explorer.
- Phase 6 analytics, CSV export readiness, stronger filtering, and enterprise polish are now in place in repo scope through shared reporting contracts, guarded analytics APIs, filtered ledgers, and organization health surfaces.
- Phase 7 programmable settlement extension is now in place in repo scope through organization wallet registry, governed programmable rail selection, supported chain config, operator wallet verification, and on-chain evidence mapped into payment and receipt records.
- A first production-operations baseline is now in place in repo scope through structured runtime config, request correlation, readiness endpoints, release scripts, and CI release gating.
- A deployment and recovery baseline is now in place in repo scope through env-profile validation, release manifests, rollback-readiness checks, and backup/restore scripts.
- An observability and incident-response baseline is now in place in repo scope through API runtime metrics, operator alerting surfaces, worker queue runtime metrics, and incident runbooks.
- The next active implementation slice is live upstream identity ownership, non-local restore execution ownership, secret-manager-backed execution ownership, and environment-specific deployment runner adoption.
- The durable docs now cover both the focused v1 build track and the longer-term full-scale platform target state.

## Execution Tracks

### Focused v1 build track

This track delivers the product wedge described in the current phases:

1. Phase 0 — Foundation hardening and real application baseline
2. Phase 1 — Premium demo foundation
3. Phase 2 — Core buyer workflow
4. Phase 3 — Seller workflow
5. Phase 4 — Payments and receipts
6. Phase 5 — Operator controls and exceptions
7. Phase 6 — Analytics and enterprise polish
8. Phase 7 — Programmable settlement extension

### Platform engineering track

This track makes the product operable at scale:

- environment model
- deployment topology
- configuration and secret management
- observability
- background job reliability
- operational tooling
- cost and scaling controls

### Operational maturity track

This track makes Atlas safe to run:

- incident response
- backup and restore
- release gating
- rollback strategy
- support runbooks
- audit export readiness
- data lifecycle handling

### Security and compliance track

This track makes Atlas safe to trust:

- auth maturity
- authorization depth
- tenant-isolation guardrails
- support-access constraints
- seller trust boundaries
- privacy and deletion handling
- future compliance programs

### Post-v1 expansion track

This track extends the product after the focused wedge is working:

- billing and rail expansion
- enterprise governance depth
- API productization
- richer seller onboarding
- broader procurement and workflow expansion

## Exact Phase Order For The Focused V1 Track

1. Phase 0 — Foundation hardening and real application baseline
2. Phase 1 — Premium demo foundation
3. Phase 2 — Core buyer workflow
4. Phase 3 — Seller workflow
5. Phase 4 — Payments and receipts
6. Phase 5 — Operator controls and exceptions
7. Phase 6 — Analytics and enterprise polish
8. Phase 7 — Programmable settlement extension

## Dependency Ordering Across Tracks

- Focused v1 product work starts first because the product wedge defines the platform boundary.
- Platform engineering starts lightly in Phase 0 and becomes release-critical before design partner and beta stages.
- Security and compliance guardrails begin in Phase 0 with actor context and tenant boundaries, then deepen before real-world rollout.
- Operational maturity work starts before Phase 4 because payment execution, receipts, and support actions require stronger runtime discipline.
- Post-v1 expansion only begins after the focused v1 lifecycle is credible and the operational baseline is stable.

## What Is Required For A Production-Grade Focused V1

The following are required before calling the focused wedge production-grade:

- focused v1 phases through at least Phase 6 implemented for the scoped product
- real actor context and organization-aware authorization
- repeatable payment and receipt evidence flow
- operator exception handling and audit explorer baseline
- observability, backup, restore, rollback, and release gating defined and tested
- tenant-boundary guardrails in application logic and operational tooling
- constrained support access and reason capture for internal actions
- documented environments, incidents, and deployment procedures
- signed session handling, identity assertion exchange into persisted Atlas sessions, and constrained internal support access

Phase 7 is valuable but not required for a production-grade off-chain focused v1. It is required only for programmable settlement maturity.

## What Is Required For Full-Scale Product Maturity

The following move Atlas beyond the focused wedge into broader platform maturity:

- richer seller onboarding and trust scoring
- external API productization and SDK maturity
- billing maturity beyond one or two rails
- enterprise admin and governance depth
- stronger environment isolation and deployment automation
- deeper observability, incident tooling, and service ownership
- broader compliance and security programs
- larger release and rollout discipline across segments and regions

## Release Stages

- internal concept demo
- functional alpha
- design partner pilot
- private beta
- public beta
- GA
- enterprise rollout

Stage-specific go or no-go requirements live in [release-maturity-model.md](./release-maturity-model.md).

## Phase Plans

### Phase 0 — Foundation hardening and real application baseline

Detailed doc: [phase-0-foundation-detailed.md](../backlog/phase-0-foundation-detailed.md)

Focused v1 purpose:

- create actor-aware product shells, domain skeletons, seeds, and queue conventions

Required platform and operations work in or near this phase:

- session and actor model boundaries
- initial tenant-boundary rules
- environment and config discipline
- queue family conventions
- verification reliability

Exit criteria:

- local-first auth and session baseline exists
- actor context exists across web and API
- buyer, seller, and operator workspaces use a real product shell
- shared UI primitives exist and are reused
- domain module skeletons exist in the API
- seeds support realistic dashboards and demo paths
- queue namespace conventions exist
- docs reflect the real Phase 0 state

### Phase 1 — Premium demo foundation

Detailed doc: [phase-1-demo-foundation-detailed.md](../backlog/phase-1-demo-foundation-detailed.md)

Focused v1 purpose:

- make Atlas category-clear, premium, and demoable

Required platform and operations work in or near this phase:

- stable seeded data management
- scenario coherence across web, API, and worker
- cleaner environment-specific demo controls if needed

### Phase 2 — Core buyer workflow

Detailed doc: [phase-2-core-buyer-workflow-detailed.md](../backlog/phase-2-core-buyer-workflow-detailed.md)

Focused v1 purpose:

- deliver the first real controlled-spend loop for buyers

Required platform and operations work in or near this phase:

- stronger validation and idempotency
- policy version persistence
- audit completeness
- first meaningful tenant-aware request boundaries

### Phase 3 — Seller workflow

Detailed doc: [phase-3-seller-workflow-detailed.md](../backlog/phase-3-seller-workflow-detailed.md)

Focused v1 purpose:

- make the product meaningfully two-sided

Required platform and operations work in or near this phase:

- seller trust boundaries
- seller-facing operational visibility
- webhook contract discipline

### Phase 4 — Payments and receipts

Detailed doc: [phase-4-payments-and-receipts-detailed.md](../backlog/phase-4-payments-and-receipts-detailed.md)

Focused v1 purpose:

- make payment execution and evidence real

Required platform and operations work in or near this phase:

- stronger queue reliability
- secret handling for payment rails
- reconciliation observability
- backup and rollback thinking for financial records

### Phase 5 — Operator controls and exceptions

Detailed doc: [phase-5-operator-controls-detailed.md](../backlog/phase-5-operator-controls-detailed.md)

Focused v1 purpose:

- make failure handling and investigation trustworthy

Required platform and operations work in or near this phase:

- support tooling guardrails
- incident triage baseline
- safer internal action boundaries
- signed support-access flow with tenant targeting and read-only enforcement

### Phase 6 — Analytics and enterprise polish

Detailed doc: [phase-6-analytics-and-polish-detailed.md](../backlog/phase-6-analytics-and-polish-detailed.md)

Focused v1 purpose:

- make Atlas design-partner-ready and enterprise-credible

Required platform and operations work in or near this phase:

- export readiness
- retention-aware reporting
- performance and accessibility discipline

Repo status:

- Phase 6 is now complete in repo scope.

### Phase 7 — Programmable settlement extension

Detailed doc: [phase-7-programmable-settlement-detailed.md](../backlog/phase-7-programmable-settlement-detailed.md)

Focused v1 purpose:

- add programmable settlement after the off-chain platform is credible

Required platform and operations work in or near this phase:

- rail governance
- chain-specific monitoring
- stronger financial evidence normalization

Repo status:

- Phase 7 is now complete in repo scope.

## Operational Readiness Gates By Release Stage

### Internal concept demo

- seeded scenarios work
- core routes and shells are coherent
- no real money or customer data reliance

### Functional alpha

- real request and approval paths exist
- actor-aware authorization exists
- seeded and local environments are reproducible

### Design partner pilot

- payment and receipt evidence flow exists for the narrow wedge
- operator investigation baseline exists
- initial observability and incident handling exist

### Private beta

- release gating, rollback, and backup paths are defined
- tenant-boundary guardrails are validated
- support access model is constrained

### Public beta

- environment discipline is stronger
- alerting and operational ownership are explicit
- reliability and data lifecycle risks are reviewed

### GA

- product, platform, and operations tracks all meet the scoped focused-v1 standard
- customer-facing docs and support workflows exist
- security posture is strong enough for intended customers

### Enterprise rollout

- stronger auth and SSO maturity
- deeper audit, export, isolation, and support controls
- roadmap for compliance and enterprise deployment expectations is active

## Detailed Do Not Do Yet List

- do not build blockchain settlement in Phase 0 or 1
- do not add production SSO in Phase 0
- do not introduce multiple frontend apps
- do not replace seeded realistic state with frontend-only mock state
- do not build physical goods flows
- do not widen infra with message buses or Kubernetes before there is a proven need
- do not overcomplicate queues before approval, payment, and webhook families are real
- do not overfit the product to one seller type too early
- do not treat the full-scale blueprint as permission to skip the focused v1 sequence

## Success Criteria By Stage

### Success after Phase 0

The repo and app both feel real. Actor-aware shells, seeds, and domain module structure exist.

### Success after Phase 2

A buyer can truly create and control a spend request.

### Success after Phase 4

Atlas can execute, prove, and record digital purchases.

### Success after Phase 6

Atlas is a production-grade focused v1 candidate for the narrow wedge if the platform and operations gates are also satisfied.

### Success after Phase 7

Atlas has programmable settlement credibility without losing its core narrative.

## Definition Of Done For Any Slice

A slice is done only when:

- code compiles
- types pass
- the slice uses repo conventions
- docs are updated if durable behavior changed
- local session memory is updated
- the UI or API change is coherent with the data model
- verification commands are stated and run
- safe push passes

## Exact Recommendation From Current Repository State

The next safest implementation slice is now:

- deeper observability and incident ownership from [production-operations-blueprint.md](./production-operations-blueprint.md)
- auth and tenancy hardening from [security-and-compliance-roadmap.md](./security-and-compliance-roadmap.md)
- broader release-stage enforcement from [release-maturity-model.md](./release-maturity-model.md)

The focused v1 and programmable-settlement tracks are now complete in repo scope. Operations, deployment/recovery, observability/incident, signed-session, direct external OIDC exchange into persisted Atlas sessions, campaign-driven access review, provider-session revocation, identity-link lifecycle governance, assignment-backed external identity provisioning and deprovisioning, actor-scoped reporting/export enforcement, tenant-read audit events, restore-drill verification with proof-bearing reports, secret-rotation execution reports, upstream identity execution reports, provider-aware adapter scripts, shared promotion bundle generation, artifact-bound promotion bundles, and promotion execution reports also exist. Future work should concentrate on live upstream identity ownership, non-local restore execution ownership, secret-manager-backed execution ownership, and stronger environment-specific deployment runner adoption before broader real-world rollout.
