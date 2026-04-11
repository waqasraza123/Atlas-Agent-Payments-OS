# Phase 7 Programmable Settlement Extension

## Goal

Add blockchain settlement as an optional extension after the offchain control plane, receipts, and operator workflows are already credible.

## Dependencies

- Phase 6 complete
- payment abstraction stable
- receipt evidence model stable

## Workstreams

### 1. Wallet and rail registry

- Add organization-level wallet registry and allowed-rail settings.
- Store verified seller wallet details separately from offchain payout references.

### 2. Onchain settlement adapter

- Implement an EVM-compatible settlement adapter behind the same payment abstraction used by Stripe and the simulated rail.
- Start with a development network first, then promote to a production rail only after operator and reconciliation flows are proven.

### 3. Evidence mapping

- Store transaction hash, chain ID, explorer link, confirmation status, and settlement timestamps.
- Map onchain evidence into the same Atlas receipt and audit timeline model used by offchain rails.

### 4. Control and risk rules

- Require explicit organization-level enablement for onchain rails.
- Add max-amount limits and mandatory approval policies for onchain settlement.
- Add operator views for confirmation delays and chain-specific failures.

## Technical deliverables

- wallet registry schema and API
- onchain settlement adapter
- unified payment evidence model
- operator filters for rail type and confirmation state

## Acceptance criteria

- Atlas can represent offchain and onchain settlement in one coherent lifecycle
- onchain payments remain optional and policy-bounded
- receipts and audit records remain consistent regardless of rail
