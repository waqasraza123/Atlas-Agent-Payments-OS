# Phase Backlog

Use the detailed phase files in this directory as the authoritative implementation sequence for Atlas Agent Payments OS. The master sequencing source of truth is [master-execution-plan.md](../architecture/master-execution-plan.md).

These phase docs describe the focused v1 build track. The broader product, platform, operations, security, and release target state lives in the blueprint docs under `docs/architecture/`.

## Order

1. [phase-0-foundation-detailed.md](./phase-0-foundation-detailed.md)
2. [phase-1-demo-foundation-detailed.md](./phase-1-demo-foundation-detailed.md)
3. [phase-2-core-buyer-workflow-detailed.md](./phase-2-core-buyer-workflow-detailed.md)
4. [phase-3-seller-workflow-detailed.md](./phase-3-seller-workflow-detailed.md)
5. [phase-4-payments-and-receipts-detailed.md](./phase-4-payments-and-receipts-detailed.md)
6. [phase-5-operator-controls-detailed.md](./phase-5-operator-controls-detailed.md)
7. [phase-6-analytics-and-polish-detailed.md](./phase-6-analytics-and-polish-detailed.md)
8. [phase-7-programmable-settlement-detailed.md](./phase-7-programmable-settlement-detailed.md)

## Legacy Summary Docs

The existing phase summary docs remain in the repo as lightweight companions, but they are not the execution source of truth. Use the detailed phase docs above for implementation work.

## Rules

- Do not overlap phases unless a dependency is explicitly called out as parallel-safe.
- Phase exit criteria are binding.
- Architecture changes that affect multiple phases require an ADR before implementation.
