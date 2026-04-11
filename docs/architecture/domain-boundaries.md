# Domain Boundaries

## Core bounded areas

### Organizations and membership

- Buyer organizations purchase services through agents.
- Seller organizations expose paid APIs and digital services.
- Operator organizations support platform oversight and demos.
- Memberships define which humans can act within each organization.

### Agent registry

- Represents machine actors that can request spend.
- Tracks operational status, ownership, and linked control policy.
- Does not include inference execution or orchestration logic in this phase.

### Policy and controls

- Stores human-defined spending rules and enforcement configuration.
- Owns future budget limits, allowlists, approval thresholds, and risk controls.
- Phase 0 only scaffolds the concept and storage shape.

### Requests and approvals

- Captures requested spend by agents.
- Tracks review state, approver identity, and decision metadata.
- Separates request state from payment execution state.

### Payments and receipts

- Payments represent financial execution records.
- Receipts represent proof artifacts and structured receipt metadata.
- Both remain placeholders in Phase 0 and must not imply live settlement.

### Audit and operator oversight

- Audit events record important system actions with actor, target, and payload metadata.
- Operator workflows consume audit data and control-plane exceptions.
- This boundary must remain append-focused and traceable.

### Demo experience

- Demo data and premium walkthrough flows exist to support product storytelling.
- Demo concerns must reuse real domain models instead of creating a parallel fake product model.

## Boundary rules

- The web app may compose multiple bounded areas, but API modules and worker jobs should map clearly back to one domain owner.
- Shared packages expose primitives, not orchestration-heavy workflows.
- Policy and approval logic should stay isolated from payment execution logic.
- Audit writes should be possible from every domain area without coupling domains together.

## Intentional exclusions

- Billing subscriptions
- Vendor payouts
- Physical goods and logistics
- Marketplace search and ranking
- External identity provider details
