# Product Spec v1

This file is now a summary companion. The authoritative product source of truth is [master-product-spec.md](./master-product-spec.md).

## Product summary

Atlas Agent Payments OS is a premium B2B platform that lets organizations give AI agents the ability to spend on paid APIs and digital services under human-defined controls. The product sits between agents and paid digital actions and provides policy enforcement, approval workflows, payment orchestration, receipts, and auditability.

## Vision

Let agents buy things without losing control.

## Product promise

- bounded authority for agents
- policy-based spending control
- human approvals where needed
- durable receipts and evidence
- operator-grade visibility and auditability

## Initial wedge

The first version focuses on paid APIs and digital services because that wedge is:

- faster to implement end to end
- easier to demo credibly
- free from physical logistics and returns
- more legible for B2B buyers evaluating agent spending

## Primary users

- buyer organizations running AI agents
- seller organizations exposing paid digital services
- operator, finance, security, and support stakeholders who need visibility and control

## Core personas

- Founder or AI product operator: wants speed, narrative clarity, and a premium product surface
- Platform engineer: wants policy control, clean workflows, and inspectability
- Finance or operations lead: wants bounded budgets, approvals, receipts, and audit exports
- Seller or digital service provider: wants a clean way to expose agent-payable services
- Enterprise evaluator: wants seriousness, trust signals, and obvious governance

## Product goals

### Primary

- let organizations authorize AI agents to perform paid digital actions safely
- make budgets, approvals, and exposure legible to finance and operations
- let sellers expose payable digital services in a trustworthy way
- make every significant action easy to inspect, explain, and reconcile
- create a premium product that looks credible in front of clients and design partners

### Non-goals

- physical goods and logistics
- consumer shopping
- generic marketplace breadth
- ERP replacement
- accounting suite replacement

## Product principles

- agents can move fast, but never invisibly
- human control is a feature, not friction
- money movement must feel legible
- the product should feel like a command center
- the core narrative is controlled autonomy

## Core product objects

- Organization
- Agent
- Seller
- Service
- Payable endpoint
- Spending policy
- Request
- Approval
- Payment
- Receipt
- Audit trail

## Main product areas

- Overview
- Agents
- Policies
- Requests
- Approvals
- Payments
- Sellers
- Services
- Receipts
- Audit
- Settings
- Operator controls

## Key workflows

### Agent requests a paid service

1. An agent identifies a payable digital service.
2. Atlas creates a spend request.
3. Policy evaluation determines whether the request can proceed automatically or needs approval.
4. Approval runs or is skipped.
5. Payment executes.
6. Seller delivery completes or fails.
7. Receipt and audit artifacts are stored.

### Human approval

1. An approver receives a request card with agent, purpose, amount, seller, and policy context.
2. The approver approves, denies, or escalates.
3. The decision and reason become durable records.

### Seller exposes a paid service

1. Seller creates and publishes a service.
2. Buyer-side requests target that service.
3. Seller sees delivery context and returns fulfillment outcome.
4. Settlement and receipts appear in both buyer and seller histories.

### Operator review

1. Operator opens a request, payment, or receipt detail view.
2. The full timeline explains who acted, why, and what happened.
3. Operator resolves the exception or exports the record.

## Experience goals

The product should feel:

- premium
- composed
- operationally serious
- futuristic but understandable
- polished enough for demos and buyer evaluation

The product should not feel:

- crypto-native first
- dashboard-noisy
- hobbyist
- visually chaotic

## Success metrics

- time to first successful paid action
- approval completion rate
- spend visibility by agent and seller
- receipt completeness
- operator issue resolution time
- stakeholder confidence in the control plane
