# Security And Compliance Roadmap

## Purpose

This document tracks the maturity path for auth, authorization, tenancy, auditability, privacy, and later compliance-facing workstreams.

## Auth Maturity Path

### Phase 0 baseline

- local-first session model
- actor context with user, organization, role, and optional agent
- replaceable auth package boundaries

### Focused v1 maturity

- stronger session handling
- organization switching discipline
- secure internal operator access model
- request correlation and runtime header discipline

### Later maturity

- enterprise SSO
- SCIM or directory provisioning if justified later
- stronger admin and support access review workflows

## Authorization Maturity Path

### Immediate requirement

- role-aware route gating
- organization-aware API authorization
- actor attribution for all state-changing actions

### Later requirement

- finer-grained permission boundaries
- environment-aware administration
- support-safe constrained actions
- reviewable internal override permissions

## Organization Isolation And Tenancy Guardrails

- every business record must be tenant-scoped
- buyer, seller, and platform contexts must remain explicit
- support tooling must not silently bypass tenant rules
- analytics, exports, and search must remain tenancy-aware

## Auditability Requirements

- append-only event model for critical actions
- reason capture for approvals, overrides, and operator actions
- lifecycle visibility for request, payment, seller, and receipt states
- durable evidence availability for support and finance workflows

## Payment And Seller Trust Boundaries

- payment rails must be abstracted and evidence-normalized
- seller delivery claims must be attributable and reviewable
- seller-facing integration trust must evolve through explicit onboarding and verification
- operator actions touching financial or seller state must remain auditable

## Data Handling Expectations

- minimize sensitive data where possible
- document ownership and lifecycle of audit, receipt, operational, and seller-provided data
- keep exports scoped and reviewable
- align retention and deletion with product promises and operational reality

## Privacy And Deletion Considerations

- tenant-aware data export
- tenant-aware deletion or archival workflows
- clear handling of support notes and operator cases
- future work for privacy review once real customer data enters the system

## Compliance Workstreams That May Matter Later

These are placeholders for tracked future work, not current claims:

- security questionnaires and enterprise buyer trust materials
- access review workflows
- key management discipline
- privacy and data retention policy maturity
- incident response maturity
- payment-related control reviews

## Intentionally Not Implemented Yet

- enterprise SSO
- advanced compliance program claims
- region-specific data residency architecture
- formal access review systems
- broad public rollout security posture
- hardened production auth beyond the current local-first and guarded internal baseline

## Must Be Done Before Broad Real-World Rollout

- real auth and session hardening beyond local-only development assumptions
- tenant-boundary validation in application and support paths
- incident handling and audit export readiness
- secrets management and rotation process
- stronger operator access constraints
- documented retention, export, and deletion behavior
