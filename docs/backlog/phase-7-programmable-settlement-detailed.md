# Phase 7 Programmable Settlement Detailed

## Goal

Add web3 and programmable settlement credibility without distorting the core product narrative.

## Why This Phase Exists

Blockchain support is an extension of the governed payment model, not the product’s initial identity. This phase adds that extension only after the off-chain platform is already credible.

## Entry Criteria

- core off-chain platform is credible and stable

## Exit Criteria

- wallet registry exists
- programmable settlement rail exists
- on-chain evidence can appear in receipt timelines
- organizations can control allowed rails

## Repo Status

- Completed in repo scope on 2026-04-12
- Buyer and seller wallet registry now exists through schema-backed organization wallets
- Supported programmable-settlement chain config now exists through shared runtime config
- Governed `PROGRAMMABLE_USDC` rail selection now exists through organization settings and verified-wallet checks
- Operator wallet verification and organization readiness views now exist
- On-chain evidence now appears in payment attempts, payment detail, and receipt evidence summaries

## Detailed Sub-Steps

### Phase 7.1 — wallet registry

- organization wallet registry
- seller wallet registry
- verification status and ownership metadata

### Phase 7.2 — supported chain configuration

- supported chain metadata
- allowed rail configuration
- environment-aware chain handling

### Phase 7.3 — USDC settlement option

- programmable rail baseline
- settlement execution adapter
- confirmation tracking model

### Phase 7.4 — on-chain evidence mapping to receipts

- transaction hash
- chain identifier
- confirmation status
- receipt evidence mapping

### Phase 7.5 — policy and governance controls for settlement rail choice

- organization-level rail restrictions
- policy-aware rail selection
- high-value rail escalation rules

## Deferred

- blockchain-first product positioning
- deep DeFi behavior
- escrow automation until later expansion

## Focused V1 Track Boundary

This phase is outside the minimum required path for a production-grade off-chain focused v1. It is a deliberate extension track for programmable settlement credibility.

## Full-Scale Platform Maturity Follow-Ons

Later tracks may add:

- broader rail governance
- more chains or settlement models
- advanced treasury and reconciliation behavior

## Verification Commands

- `pnpm build`
- programmable settlement evidence smoke test

## Acceptance Criteria

- Atlas gains programmable settlement credibility without losing its core narrative as a governed control plane
- The repo can expose programmable-settlement readiness, wallet posture, and on-chain evidence without bypassing the existing payment and receipt lifecycle model
