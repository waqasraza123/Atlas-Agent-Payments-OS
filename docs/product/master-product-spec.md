# Atlas Agent Payments OS

## Master Product Spec

**Document status:** Execution-grade source of truth  
**Version:** v1.1  
**Purpose:** Durable product memory for the focused v1 wedge and the full-scale platform target state

## Product Identity

### Brand

Atlas

### Category

Agent Payments OS

### One-line positioning

Atlas lets organizations safely authorize, approve, execute, and audit agent-driven spending on paid APIs and digital services.

### Product promise

Let agents pay without losing control.

### Product narrative

Atlas is the control plane between AI agents and paid actions. It is not a consumer shopping app, not a crypto dashboard, and not a billing page. It is the operational system that makes agent spending legible, governed, and auditable.

The first wedge is intentionally narrow: paid APIs and digital services. That wedge remains the correct v1 because it is credible, B2B-relevant, operationally simpler than physical commerce, and demoable without logistics complexity.

## V1 Wedge And Long-Term Platform Vision

### Focused v1 wedge

The initial product focuses on:

- buyer organizations that want bounded agent spending
- seller organizations exposing paid APIs and digital services
- policy-driven approval and payment control
- receipts, audit trails, and operator visibility
- premium dashboards and seeded demo flows

### Long-term platform vision

The long-term product expands from a focused control plane into a broader machine-commerce platform with:

- richer enterprise governance and delegation
- a seller network with stronger onboarding and trust models
- multiple payment rails and billing models
- API productization and developer-facing surfaces
- deeper operator, support, and investigation tooling
- stronger deployment, security, compliance, and reliability posture
- post-v1 procurement and programmable settlement extensions

### Product boundary rule

The long-term platform vision must never dilute the current v1 wedge. The full-scale platform grows outward from the v1 control plane rather than replacing it.

## Executive Summary

AI agents can already discover tools, plan work, and call APIs. The missing layer is financial trust. Teams need to know:

- who authorized the spend
- which organization is liable
- which budget applies
- whether a human must approve
- how the service provider confirms delivery
- what evidence exists for finance, security, and operations afterward

Atlas solves this by combining:

- agent identity
- organization context
- spending policies
- approval workflows
- payment orchestration
- seller service exposure
- receipts
- audit trails
- operator controls
- premium dashboards for buyers, sellers, and platform operators

The platform must feel beautiful, premium, and operationally serious while behaving like disciplined financial infrastructure.

## Vision, Mission, And Principles

### Vision

Give AI agents the ability to transact safely under human-defined rules, with full operational and financial accountability.

### Mission

Build the trust, approvals, payment, and audit layer that turns agent spending from risky improvisation into governed software behavior.

### Product Principles

1. Controlled autonomy over unrestricted autonomy
2. Every important action must be legible
3. Human control should feel elegant
4. The data model must reflect reality
5. Audit is a first-class product feature
6. The UI must earn trust quickly
7. The first wedge should stay narrow
8. Operational trust must scale with product ambition
9. Enterprise maturity must be planned before it is implemented

## Why Now

Atlas matters now because:

- AI agents are moving from read-only helpers to action-taking systems
- paid APIs and digital services are increasingly composable
- enterprises want control layers before enabling automation to spend
- machine-to-machine commerce needs approval and audit infrastructure
- finance and security stakeholders require durable evidence before broader adoption

The opportunity is the financial and operational control plane for agent actions, not AI plus blockchain as a gimmick.

## Target Users And Stakeholders

### Primary buyer-side customer

Organizations building or using AI agents that need those agents to access paid digital services safely.

Examples:

- AI startups
- SaaS teams adding agent features
- internal platform teams
- workflow automation teams
- data-heavy product teams
- procurement automation teams
- sales, support, and research automation teams

### Secondary seller-side customer

Digital service providers who want to expose agent-friendly paid capabilities.

Examples:

- API vendors
- premium data providers
- report generators
- specialized AI tools
- internal platform teams monetizing internal tools

### Tertiary stakeholders

- finance
- operations
- security
- compliance-minded evaluators
- platform support teams
- enterprise buyer evaluators

## Personas

### Persona A — Product founder or AI startup operator

Needs a trustworthy payment layer fast without building controls, approvals, and auditability from scratch.

Cares about:

- speed to market
- demo quality
- narrative clarity
- future extensibility
- trust signals for investors and buyers

### Persona B — Platform engineer or internal tools lead

Needs a precise control plane with predictable behavior.

Cares about:

- inspectability
- clear rules
- minimal surprises
- durable architecture
- operational safety

### Persona C — Finance or operations lead

Assumes agent spending is risky until proven otherwise.

Cares about:

- budget boundaries
- approver accountability
- exportable records
- exceptions and investigation tools
- reconciliation clarity

### Persona D — Seller or digital service provider

Wants a clean way to expose a service to buyers and agents.

Cares about:

- simple setup
- clear pricing
- payment confidence
- usage visibility
- customer clarity

### Persona E — Enterprise evaluator

Needs a serious, trustworthy impression.

Cares about:

- professionalism
- approval systems
- governance
- data separation
- control and evidence

### Persona F — Security and compliance lead

Assumes autonomy is unacceptable without guardrails, auditability, tenant boundaries, and evidence of disciplined data handling.

Cares about:

- tenant isolation
- access control depth
- audit completeness
- retention and deletion behavior
- incident handling maturity
- future compliance posture

### Persona G — Platform administrator or support lead

Runs investigations, support operations, and internal oversight across multiple organizations.

Cares about:

- safe internal tooling
- search and case management
- reason capture
- constrained support access
- exportable evidence

### Persona H — Enterprise procurement or vendor-risk evaluator

Needs confidence that Atlas can be deployed and governed as a serious enterprise system.

Cares about:

- production readiness
- role and permission boundaries
- reliability expectations
- data governance
- rollout discipline

## Jobs To Be Done

### Buyer jobs

- Let my agent use paid services without giving it unrestricted spending power.
- Approve low-risk actions automatically and escalate higher-risk actions.
- See exactly what each agent spent and why.
- Pause, investigate, and explain questionable activity.
- Provide durable records to finance and leadership.

### Seller jobs

- Publish a paid service that agents can consume safely.
- Get paid in a trustworthy and observable way.
- Know that the buyer had authority.
- Track requests, outcomes, and customer usage.

### Operator jobs

- Investigate failed or suspicious flows.
- Resolve approval and fulfillment bottlenecks.
- Audit what happened without needing engineering.
- Export evidence and trace a lifecycle quickly.

### Enterprise administration jobs

- control rollout by organization, workspace, environment, and role
- validate support actions and incident handling
- understand data retention, export, and deletion behavior
- assess whether Atlas can be trusted in a production environment

## Product Scope

### In scope for focused v1

- organizations and memberships
- buyer organizations
- seller organizations
- agents
- seller services and payable endpoints
- spending policies
- spend requests
- approval routing
- payment lifecycle abstraction
- internal simulated settlement rail
- Stripe-first payment rail later in the execution sequence
- receipts
- audit timelines
- operator surfaces
- seeded demo mode
- analytics summaries
- export-friendly records

### Required for production-grade focused v1 rollout

- bounded auth and actor model
- organization-aware authorization
- durable audit trails
- repeatable operations runbooks
- release gating and environment discipline
- logging, alerting, backup, and rollback planning
- tenant-boundary guardrails
- seller onboarding trust checks
- exportable evidence paths

### Explicitly out of scope for focused v1

- physical goods
- shipping and returns
- subscriptions as the primary wedge
- corporate card replacement
- ERP procurement replacement
- broad public marketplace discovery
- contract negotiation automation
- deep accounting suite
- production SSO in Phase 0
- blockchain-first settlement in the initial build

### Post-v1 expansion areas

- recurring budgets
- delegated and multi-step approvals
- department limits
- refunds
- richer seller webhooks
- contract-driven procurement
- on-chain settlement evidence
- programmable escrow patterns
- subscriptions and usage plans
- external developer APIs and SDKs
- enterprise integration surfaces

## Product Pillars

1. Agent identity and bounded authority
2. Policy-based spending control
3. Approval and decision routing
4. Payment orchestration and evidence
5. Seller service exposure
6. Receipts and auditability
7. Operator trust surfaces
8. Premium command-center UX
9. Enterprise governance and data discipline
10. Operational reliability

## Core Concepts

### Organization

A company or team using Atlas as buyer, seller, or internal platform operator.

### Actor

The effective requesting identity in a workflow. Usually a user plus organization plus role context, sometimes acting through an agent.

### Agent

A software worker operating on behalf of an organization under policy-defined boundaries.

### Seller

An organization exposing payable digital services.

### Service

A purchasable digital capability exposed by a seller.

### Payable endpoint

A concrete service action with price and delivery semantics.

### Policy

A rule set that determines whether a request is allowed, auto-approved, escalated, denied, or blocked.

### Spend request

A proposed paid action initiated by an agent or other actor.

### Approval request

A pending human or policy-governed decision task tied to a spend request.

### Approval decision

A recorded approve, deny, escalate, or override action with actor and reason.

### Payment intent

The platform’s representation of intended payment execution.

### Payment attempt

An immutable attempt to execute settlement over a specific rail.

### Receipt

A durable record tying together request, approval, payment, service, and outcome evidence.

### Audit event

An append-only event that captures the timeline of what happened and why.

### Operator case

An internal investigative construct used for exceptions, support, or risk review.

## User Roles And Permission Model

### Buyer-side roles

- Owner
- Admin
- Approver
- Operator
- Finance
- Viewer

### Seller-side roles

- Owner
- Admin
- Operator
- Analyst

### Platform-side roles

- Support
- Risk operator
- Platform admin

### Future enterprise role expansion

- organization security admin
- tenant compliance admin
- procurement reviewer
- billing admin
- support-restricted auditor

### Permission design principles

- all state-changing actions must be attributable to an actor
- operator actions are also auditable
- permissions must be organization-aware
- internal support access must be constrained and reviewable
- Phase 0 uses local-first auth and role context, not full enterprise identity

## Product Surfaces

### Public marketing surface

Purpose:

- explain the category clearly
- sell trust and controlled autonomy
- show premium UI and workflow visuals
- convert demo interest

### Buyer workspace

Purpose:

- manage agents
- manage policies
- create and review requests
- review approvals
- inspect activity
- inspect receipts
- view vendors and services

### Seller workspace

Purpose:

- manage services
- review incoming requests
- inspect payments and payouts
- monitor delivery outcomes
- inspect customers and service usage

### Operator workspace

Purpose:

- investigate exceptions
- search cross-entity activity
- inspect audit trails
- resolve webhook or settlement issues
- manage platform support actions

### Full-scale maturity surfaces

- buyer administration and governance center
- seller onboarding and trust center
- API and developer integration surface
- internal support and case workspace
- billing and settlement operations surface
- reliability and environment operations surface

## Information Architecture

### Buyer

- Overview
- Agents
- Policies
- Requests
- Approvals
- Activity
- Receipts
- Vendors
- Team
- Settings

Buyer overview must show:

- total spend
- requests created today
- pending approvals
- successful payments
- top agents
- top sellers
- budget utilization
- exceptions requiring attention
- recent timeline activity

### Seller

- Overview
- Services
- Pricing
- Requests
- Payments
- Payouts
- Customers
- Webhooks
- Settings

Seller overview must show:

- revenue
- incoming requests
- successful settlements
- failed deliveries
- top customers
- top services
- pending confirmations

### Operator

- Global overview
- Organizations
- Transactions
- Approvals
- Exceptions
- Webhooks
- Receipts
- Audit trail
- Alerts
- Support tools

Operator overview must show:

- total organizations
- active requests
- pending approvals
- payment failures
- webhook failures
- suspicious activity flags
- stalled receipts
- seller confirmation delays

## Core Workflows

### Workflow A — Agent requests a paid service

1. Agent identifies a service or endpoint.
2. Agent submits a spend request with purpose, service, seller, and expected amount.
3. Atlas resolves organization, actor, and agent context.
4. Policy engine evaluates request.
5. Atlas decides blocked, denied, auto-approved, or manual approval required.
6. If manual approval is needed, an approval request is created.
7. Once approved, Atlas creates a payment intent.
8. Payment rail executes or simulates settlement.
9. Seller confirms delivery or Atlas records delivery state.
10. Receipt is finalized.
11. Audit timeline is complete and visible.

### Workflow B — Human approval

1. Approver sees an approval card.
2. Approver sees requesting agent, requesting org, seller and service, amount, policy matched, risk cues, and expected effect.
3. Approver decides approve, deny, escalate, or override.
4. Decision and reason are stored.
5. The next lifecycle step is triggered.

### Workflow C — Seller publishes a service

1. Seller creates service.
2. Seller defines pricing.
3. Seller defines visibility and availability.
4. Seller publishes service.
5. Buyer organizations can reference it.
6. Seller monitors requests, outcomes, and payment status.

### Workflow D — Finance or operator review

1. User opens a request, payment, receipt, or case detail view.
2. User sees the full timeline.
3. User reviews policy, approval, payment, and receipt evidence.
4. User exports or shares the record.
5. User resolves or escalates if needed.

## Lifecycle States

### Spend request states

- draft
- submitted
- blocked
- awaiting_approval
- approved
- denied
- payment_pending
- payment_in_progress
- fulfilled
- failed
- canceled

### Approval request states

- pending
- approved
- denied
- expired
- escalated
- overridden

### Payment intent states

- created
- ready
- processing
- settled
- failed
- partially_settled
- awaiting_confirmation
- canceled

### Receipt states

- draft
- awaiting_evidence
- finalized
- disputed
- archived

### Operator case states

- open
- investigating
- action_required
- resolved
- closed

## Policy Model

### Initial policy capabilities

- per-action maximum
- daily budget maximum
- weekly budget maximum
- seller allowlist
- service allowlist
- auto-approval threshold
- escalation threshold
- time-window restrictions
- emergency stop behavior
- agent activation requirement

### Later policy maturity

- department and cost-center scoping
- approver delegation
- rail-specific policies
- service category restrictions
- seller risk bands
- jurisdiction and data-boundary aware restrictions

### Policy evaluation outcomes

- allow_auto_approved
- allow_requires_approval
- deny_budget_exceeded
- deny_seller_not_allowed
- deny_service_not_allowed
- deny_org_paused
- deny_agent_inactive
- deny_emergency_stop
- escalate_threshold_exceeded

### Policy requirements

- policies must be versioned
- historical requests must point to the exact policy version evaluated
- evaluation output must be stored as a first-class record

## Payment Model

### Payment rails

Initial rails:

- internal simulated rail
- Stripe rail later in implementation

Later rails:

- programmable on-chain USDC settlement
- invoice or net-terms style settlement models
- wallet and stored-balance abstractions if later required

### Payment abstraction responsibilities

- create payment intent
- create payment attempt
- record execution outcome
- record evidence and references
- normalize settlement states
- expose timeline events

### Billing maturity beyond the first rail

The long-term platform should support:

- multiple payment rails with a common evidence model
- price, usage, and entitlement separation
- invoices, credits, and adjustments as later financial concepts
- customer-level billing views without turning Atlas into a general accounting product

### Payment evidence requirements

- rail name
- attempt number
- outcome state
- timestamps
- external reference ids where available
- errors or failure reason normalization

## Receipt Requirements

Every finalized receipt should tie together:

- buyer organization
- seller organization
- requesting agent
- responsible actor
- service purchased
- amount
- currency
- policy version used
- approval decision chain
- payment evidence
- fulfillment or delivery outcome
- timestamps
- metadata bundle
- export-ready representation

Receipts must feel official and valuable, not like loose log entries.

## Audit And Timeline Requirements

Every significant action should emit an audit event.

Minimum events:

- request_created
- policy_evaluated
- request_blocked
- manual_approval_required
- approval_granted
- approval_denied
- approval_escalated
- payment_intent_created
- payment_attempt_started
- payment_settled
- payment_failed
- seller_delivery_confirmed
- receipt_finalized
- operator_case_opened
- operator_action_taken

Timeline views should exist at request, agent, organization, seller, and operator-case level.

## Operational Trust Model

Atlas must visibly communicate:

- policy matched
- approval source
- action owner
- auditability
- receipt availability
- service identity
- organization-level control
- internal operator action history

Trust in Atlas depends on:

- bounded authority
- actor traceability
- deterministic lifecycle state
- tenant-aware authorization
- durable evidence
- recoverable operations
- support actions with reason capture

## Multi-Tenant And Organization Isolation Expectations

The product is multi-tenant by default, even if early development uses simplified local-first assumptions.

Guardrails:

- every data access path must be tenant-aware
- buyer, seller, and platform contexts must be explicit
- internal support tooling must not silently bypass tenancy rules
- exports, search, and analytics must preserve tenant boundaries
- later enterprise environments may require stricter environment, region, or account-level isolation

## External Seller Onboarding Maturity

### Focused v1

- seller profile creation
- service creation
- service visibility and pricing
- request and delivery visibility

### Later maturity

- verification workflow
- support and operations contacts
- onboarding checklist
- webhook trust and signing management
- risk scoring and seller quality signals
- contractual and compliance workflow placeholders

## API Productization Maturity

### Focused v1

- internal API for web, worker, and domain flows
- durable domain contracts

### Later maturity

- external buyer API
- seller-facing integration API
- SDKs and examples
- rate limiting and quota controls
- versioned external contracts
- customer-facing developer docs

## Support, Operations, And Internal Admin Maturity

The full-scale product must support:

- constrained support access
- investigation case workflows
- internal annotations and handoff
- reason-required overrides
- audit-backed remediation actions
- customer-safe exports and evidence packs

## Data Governance And Lifecycle Expectations

Atlas should treat governance as a product and platform concern.

Expectations:

- explicit retention strategy by data class
- deletion and archival paths
- exportability for audit and customer support
- durable receipt and audit evidence
- documented ownership of customer-generated, system-generated, and seller-generated data
- future policy for PII minimization and restricted field handling

## Reliability Expectations

### Focused v1 expectations

- request and approval flows should be explainable and recoverable
- failed background work should be visible and retryable
- receipts and audit trails should not be silently lost
- platform failures must surface clearly to operators

### Full-scale expectations

- environment-specific SLOs
- deploy-time and runtime safety checks
- backup, recovery, and rollback readiness
- monitoring for user-facing and queue-driven lifecycle failures

## Launch Stages

- internal concept demo
- functional alpha
- design partner pilot
- private beta
- public beta
- GA
- enterprise rollout

Each stage should advance product, platform, operations, security, and documentation readiness together. The detailed criteria live in [release-maturity-model.md](../architecture/release-maturity-model.md).

## Design Direction

### Visual intent

- premium command center
- calm financial seriousness
- AI-native polish
- sharp hierarchy
- restrained motion
- rich activity surfaces
- cinematic detail panels

### Product should feel like

- modern financial operations platform
- design-forward B2B SaaS
- AI-native control system

### Product should not feel like

- crypto exchange
- noisy admin panel
- hobby project
- prompt wrapper demo

### Signature UI moments

- hero dashboard
- beautiful approval cards
- cinematic lifecycle timeline
- seller service gallery
- agent profile page with identity and behavior

## Technical Direction

### Stack

- Node.js 24
- pnpm workspaces
- Turborepo
- TypeScript
- Next.js App Router
- React
- Tailwind CSS
- NestJS
- PostgreSQL
- Prisma
- Redis
- BullMQ
- MinIO
- Docker Compose for local infra

### Local development philosophy

- run infra in Docker
- run app processes natively
- optimize for a 2019 Intel MacBook Pro
- keep local boot commands simple
- avoid premature infrastructure expansion

### Monorepo structure

- `apps/web`
- `apps/api`
- `apps/worker`
- `packages/ui`
- `packages/config`
- `packages/types`
- `packages/database`
- `packages/auth`
- `packages/domain`
- `docs`
- `infra/docker`
- `scripts`
