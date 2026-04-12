# Production Operations Blueprint

## Purpose

This document defines the operational maturity expected for Atlas to move from a repo-ready build into a real production service.

## Environments Strategy

Baseline environments:

- local
- development
- staging
- production

Expected discipline:

- config must be environment-specific
- production-only secrets must never appear in repo memory or local scratch docs
- release promotion should move forward through environments rather than skipping straight to production

## Deployment Topology Expectations

Current repo structure supports a modular monolith with:

- one web app
- one API
- one worker
- one transactional database
- one Redis deployment
- one object storage system

Expected production evolution:

- separate runtime processes for web, API, and worker
- dedicated managed data stores
- isolated production environment
- operational visibility across queue, database, and storage dependencies

Exact cloud provider, hosting target, and network design are intentionally deferred until deployment decisions are made.

## Secrets And Configuration Management Expectations

- environment variables must be explicit and documented
- production secrets must live in a secret management system, not in repo files
- secrets should be rotated through a controlled operational process
- configuration drift between environments should be minimized and reviewable
- signing secrets for app sessions and support-access flows must be environment-specific and rotation-ready

## Logging, Tracing, Metrics, And Alerting

Logging expectations:

- structured logs
- actor and request correlation identifiers
- background job correlation
- payment and webhook event traceability

Metrics expectations:

- request latency and error rates
- queue depth and retry rates
- payment success and failure rates
- seller fulfillment delay metrics
- receipt finalization lag

Alerting expectations:

- repeated queue failure
- payment rail failure
- seller confirmation delay
- failed deployment or migration
- materially degraded API or worker health

Tracing is likely required once the product operates across web, API, worker, and external integrations at meaningful scale.

## SLO And SLA Thinking

Initial direction:

- define internal SLOs before external SLAs
- keep user-facing expectations narrow for focused v1
- add differentiated targets later by feature and customer tier

Critical lifecycle areas likely to need explicit SLOs:

- request acceptance
- approval decision propagation
- payment processing
- receipt availability
- operator alert responsiveness

## Backups And Disaster Recovery

Expected capabilities before broad rollout:

- scheduled database backups
- restore testing
- object storage durability plan
- recovery procedure for queue-backed lifecycle work
- documented disaster recovery ownership

The product should not claim production readiness without a proven restore path.

## Incident Response

Minimum expectations:

- incident severity model
- named ownership during incidents
- runbooks for common failure modes
- internal communication path
- customer-impact assessment process
- post-incident learning loop

## Data Retention And Deletion

- retention classes should be defined for audit, receipts, operational logs, and support records
- deletion behavior should be explicit for customer data and internal case data
- archival should preserve evidence value where deletion is not appropriate
- deletion and export paths must remain tenant-aware

## Key Rotation And Secret Rotation Expectations

- rotation capability should exist for API keys, payment-provider secrets, webhook signing secrets, and internal support credentials
- rotation should have rollback-aware procedures
- changes should be traceable and tested in lower environments first

## Audit And Export Readiness

Atlas must support:

- exportable receipts
- exportable audit timelines
- operator investigation evidence packs
- customer-safe support artifacts

This is both a product feature and an operational readiness requirement.

## Release Gating

Each release should verify:

- schema and migration safety
- environment-specific configuration correctness
- queue consumer readiness
- rollback feasibility
- support and incident awareness for the change

The detailed stage model is defined in [release-maturity-model.md](./release-maturity-model.md).

## Rollback Strategy

- releases should have a defined rollback path
- incompatible schema changes must be planned carefully
- worker and API changes must consider in-flight lifecycle state
- payment and receipt flows require special caution because they operate on durable financial evidence

## Cost Controls And Scaling Watchouts

- queue growth can create hidden cost and operational pressure
- audit-heavy storage patterns can become expensive without retention planning
- analytics and search workloads may need separation from primary transactional paths later
- object storage use for evidence and exports should be monitored

## Focused V1 Versus Full-Scale Expectation

## Current Repo Status

- structured runtime config baseline exists
- release verification script and CI release gate exist
- API liveness, startup, and readiness endpoints exist
- request-correlation headers and structured runtime logging exist
- env-profile validation, release manifests, rollback-readiness verification, and backup/restore scripts now exist
- API metrics, operator observability routes, and incident runbooks now exist
- signed session handling, direct external OIDC exchange into persisted Atlas sessions, reviewable and recertifiable support-access grants, campaign-driven review automation, provider-session revocation, and promotion-manifest automation now exist
- actor-scoped reporting and export enforcement, tenant-read audit events, restore-drill verification, proof-bearing restore reports, backup integrity manifests, secret-rotation manifest enforcement, and artifact-bound promotion bundles now exist
- provider-aware rollout adapters, a persisted operational integration ownership registry, and a durable rollout execution ledger with integrity-tracked proof artifacts now exist, but vendor-native deployment-runner ownership, stored remote restore ownership, external alert dispatch, long-term metrics retention, live upstream identity-provider ownership, and secret-manager-native rotation ownership are still pending

### Required before a production-grade focused v1 rollout

- environment separation
- structured logging
- basic metrics and alerts
- backups and restore validation
- release gating
- rollback readiness
- incident runbooks
- signed session secret management
- constrained support access for operator workflows
- persisted support-access grant tracking and revoke capability

### Deferred toward fuller platform maturity

- advanced tracing across all subsystems
- multi-region or tenant-specific environment strategies
- highly automated disaster recovery
- deeper capacity and cost governance
- direct external identity-provider provisioning and deprovisioning beyond the current external OIDC exchange and lifecycle-governance path
