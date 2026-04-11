# Atlas Agent Payments OS

## Master Product Spec

**Document status:** Execution-grade source of truth  
**Version:** v1.0  
**Purpose:** Durable product memory and the product-side source of truth for future implementation work

## Product Identity

### Working brand

Atlas

### Category

Agent Payments OS

### One-line positioning

Atlas lets organizations safely authorize, approve, execute, and audit agent-driven spending on paid APIs and digital services.

### Product promise

Let agents pay without losing control.

### Product narrative

Atlas is the control plane between AI agents and paid actions. It is not a consumer shopping app, not a crypto dashboard, and not a billing page. It is the operational system that makes agent spending legible, governed, and auditable.

The first product wedge is narrow on purpose: paid APIs and digital services. That gives Atlas a fast, credible, demoable starting point with immediate B2B relevance and minimal logistics complexity.

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

The platform should feel beautiful, premium, and operationally serious while still behaving like real financial infrastructure.

## Vision, Mission, and Principles

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

## Why Now

Atlas matters now because:

- AI agents are moving from read-only helpers to action-taking systems
- paid APIs and digital services are increasingly composable
- enterprises want control layers before enabling automation to spend
- machine-to-machine commerce needs approval and audit infrastructure
- finance and security stakeholders require durable evidence before broader adoption

The opportunity is the financial and operational control plane for agent actions, not AI plus blockchain as a gimmick.

## Target Users and Stakeholders

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

## Product Scope

### In scope for v1

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

### Explicitly out of scope for v1

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

### Later expansion areas

- recurring budgets
- multi-step delegated approvals
- department limits
- refunds
- richer seller webhooks
- contract-driven procurement
- on-chain settlement evidence
- programmable escrow patterns

## Product Pillars

1. Agent identity and bounded authority
2. Policy-based spending control
3. Approval and decision routing
4. Payment orchestration and evidence
5. Seller service exposure
6. Receipts and auditability
7. Operator trust surfaces
8. Premium command-center UX

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

## User Roles and Permission Model

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

### Permission design principles

- all state-changing actions must be attributable to an actor
- operator actions are also auditable
- permissions should be organization-aware
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

Buyer overview dashboard must show:

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

Seller overview dashboard must show:

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

Deferred rail:

- programmable on-chain USDC settlement

### Payment abstraction responsibilities

- create payment intent
- create payment attempt
- record execution outcome
- record evidence and references
- normalize settlement states
- expose timeline events

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

Receipts should feel official and valuable, not like loose log entries.

## Audit and Timeline Requirements

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

## Notifications

### Notification types

- pending approval
- approval granted
- approval denied
- budget threshold reached
- unusual activity flagged
- payment failed
- seller confirmation delayed
- payout completed
- operator action required

### Notification delivery channels

Initial implementation:

- in-app notifications
- placeholder email structure later

Notifications should feel important and crisp, not noisy.

## Search, Filtering, and Discoverability

### Search must support

- organizations
- agents
- sellers
- services
- requests
- approvals
- payments
- receipts
- audit events

### Filtering must support

- date range
- amount range
- status
- organization
- agent
- seller
- service
- approval status
- request type
- risk marker

The experience should feel instant and focused, especially for operator workflows.

## Analytics and Reporting

### Buyer analytics

- spend over time
- spend by agent
- spend by seller
- spend by service
- auto-approved vs manual-approved
- approval turnaround time
- exception rate
- budget utilization

### Seller analytics

- revenue over time
- usage by buyer
- top services
- success vs failure
- payout status
- repeat buyers

### Platform analytics

- active organizations
- active agents
- total requests
- total approvals
- exception count
- successful payments
- request-to-completion time

### Reporting outputs

- CSV export
- PDF receipts later
- audit bundle export later

## Trust and Safety Model

Atlas must visibly communicate:

- policy matched
- approval source
- action owner
- auditability
- receipt availability
- service identity
- organization-level control

Internal safety assumptions:

- suspicious behavior can be paused
- high-value actions can be escalated
- overrides always require reason capture
- operator and admin actions are auditable

## Accessibility and Usability

Requirements:

- strong readability
- keyboard-usable flows
- clear contrast
- no color-only state communication
- screen states paired with text and iconography
- premium empty, loading, and error states

The product must not sacrifice clarity for aesthetics.

## Demo Mode Requirements

Atlas needs a premium seeded demo mode that tells the story quickly.

Demo mode must include:

- seeded buyer org
- seeded seller org
- seeded operator context
- several agents
- several services
- multiple policies
- pending approvals
- successful path
- failed path
- exception path
- polished dashboards
- beautiful timeline views

Core demo story:

1. Agent requests a paid service.
2. Policy evaluation requires approval.
3. Human approval is granted.
4. Payment executes.
5. Seller confirms delivery.
6. Receipt appears.
7. Dashboards update.
8. Audit timeline is inspectable.

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
