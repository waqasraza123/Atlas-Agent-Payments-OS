# Auth And Support-Access Baseline

## Purpose

This runbook defines the current signed-session, external identity-provider exchange, persisted auth-session, and internal support-access baseline after the latest rollout-hardening auth slice.

## Current Session Types

- signed local user session
- signed identity-provider exchange session
- signed internal support-access session

All current session types are HMAC-signed and time-bounded. Local development and controlled internal support still use Atlas-issued sessions. Identity assertions are now exchanged into persisted Atlas sessions rather than being consumed directly by downstream routes.

## Runtime Requirements

- `AUTH_SESSION_SIGNING_SECRET`
- `AUTH_LOCAL_SESSION_TTL_MINUTES`
- `AUTH_SUPPORT_ACCESS_TTL_MINUTES`
- `AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS`
- `AUTH_PROVIDER_MODE`
- `AUTH_IDENTITY_BRIDGE_SECRET`
- `AUTH_IDENTITY_BRIDGE_PROVIDER`
- `AUTH_IDENTITY_SESSION_TTL_MINUTES`

`AUTH_SESSION_SIGNING_SECRET` is required in the API and web runtimes. `AUTH_IDENTITY_BRIDGE_SECRET`, `AUTH_IDENTITY_BRIDGE_PROVIDER`, and `AUTH_IDENTITY_SESSION_TTL_MINUTES` are required when `AUTH_PROVIDER_MODE=identity-bridge`. `AUTH_EXTERNAL_OIDC_ISSUER`, `AUTH_EXTERNAL_OIDC_AUDIENCE`, `AUTH_EXTERNAL_OIDC_PROVIDER`, `AUTH_EXTERNAL_OIDC_JWKS_JSON`, and `AUTH_IDENTITY_SESSION_TTL_MINUTES` are required when `AUTH_PROVIDER_MODE=external-oidc`.

## Local Session Behavior

- local session issuance is only allowed in `local` and `development`
- the web session route signs the cookie payload before storing it
- the API and web runtimes reject tampered or expired session tokens
- the API and web runtimes also reject local-development session tokens whenever the runtime is not `local` or `development`
- the API and web runtimes also reject local-development session tokens whenever `AUTH_PROVIDER_MODE` is not `local-signed`
- fallback default profiles remain limited to local and development

## Identity-Bridge Exchange Behavior

- identity-bridge assertions are carried through `x-atlas-auth-assertion`
- the web runtime exchanges verified identity assertions through `/auth/provider-exchange`
- the exchange creates a persisted Atlas auth session tied to user, organization, membership, and provider identity
- downstream web and API requests use the exchanged signed Atlas session rather than the raw assertion
- the API validates the exchanged session against stored auth-session records before actor resolution
- local session issuance is disabled when the runtime is configured for `identity-bridge`

## External OIDC Exchange Behavior

- external OIDC tokens are exchanged through `/auth/provider-exchange`
- the web runtime verifies issuer, audience, provider, and RS256 signature against configured JWKS keys
- the exchange requires an active persisted external identity assignment for the exact provider, email, and Atlas membership
- the exchange creates a persisted Atlas auth session tied to user, organization, membership, and provider identity
- downstream web and API requests use the exchanged signed Atlas session rather than the raw OIDC token
- the API validates the exchanged session against stored auth-session records before actor resolution
- local session issuance is disabled when the runtime is configured for `external-oidc`

## Support-Access Behavior

- support access is initiated from `/operator/support-access`
- only buyer and seller tenants can be targeted
- a reason is required before a support session is issued
- every new support request enters `PENDING_REVIEW`
- support requests must be reviewed by an org `OWNER` or `ADMIN`
- self-review is blocked
- support-access sessions carry both the principal operator identity and the target tenant identity
- support-access sessions are read-only at the API guard layer
- support-mode writes are also blocked in shared buyer, seller, payment, and programmable-settlement workflow layers
- support-access issuance is allowed in production only when `AUTH_PROVIDER_MODE=identity-bridge` or `AUTH_PROVIDER_MODE=external-oidc`
- operator governance actions require provider-backed Atlas sessions outside local and development
- operator governance actions require provider-backed Atlas sessions during `public-beta`, `ga`, and `enterprise-rollout`
- operator governance actions require external OIDC-backed Atlas sessions during `ga` and `enterprise-rollout`
- allowed support issuer emails can be limited through `AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS`
- every issued support session creates a persisted grant record
- every review decision creates a persisted review record
- approved grants must be explicitly activated by the requester before support mode starts
- support-grant activation rejects local-signed grants outside local and development
- support-grant activation rejects non-external-OIDC grants during `ga` and `enterprise-rollout`
- support grants can be revoked explicitly before TTL expiry
- expired grants are marked expired when read
- active grants move to recertification-required when review expiry is reached
- recertification writes a new persisted review record and refreshes grant review expiry
- operator governance can open review campaigns for due or recertification-required grants
- review campaign items can recertify or revoke existing grants
- operator governance can revoke active provider-backed tenant sessions from the same surface
- operator governance can suspend, reactivate, or revoke persisted provider identity links from the same surface
- operator governance can provision, suspend, reactivate, and revoke persisted external identity assignments from `/operator/identity-access`
- command-mode upstream identity sync can now drive vendor-native Okta application assignment ownership and Auth0 organization membership ownership while persisting upstream subjects, provider references, and last sync posture on each Atlas assignment
- support-mode sessions are blocked from CSV export and actor-scoped reporting paths that would bypass tenant-safe inspection rules

## Current Gaps

- no external approval workflow outside Atlas for issuing support grants
- no upstream push integration beyond the current Okta application-assignment and Auth0 organization-membership ownership baseline

## Verification Commands

1. `pnpm --filter @atlas/auth test`
2. `pnpm --filter @atlas/api test -- --run test/actor.service.test.ts test/app.e2e.test.ts`
3. `pnpm --filter @atlas/web test -- --run src/app/auth/session/route.test.ts`
4. `pnpm verify:env`
5. `pnpm verify:release`

## Next Hardening Step

- add deeper tenant-boundary enforcement beyond the current operator-governance and reporting/export guardrails
- add broader upstream directory lifecycle coverage beyond the current Okta application-assignment and Auth0 organization-membership ownership baseline
