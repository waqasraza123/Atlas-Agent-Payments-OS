# Auth And Support-Access Baseline

## Purpose

This runbook defines the current signed-session, identity-bridge, and internal support-access baseline after the rollout-hardening auth slice.

## Current Session Types

- signed local user session
- signed identity-bridge assertion session
- signed internal support-access session

Both session types are HMAC-signed and time-bounded. They are intended for local development and controlled internal support workflows, not as a substitute for a production identity provider.

## Runtime Requirements

- `AUTH_SESSION_SIGNING_SECRET`
- `AUTH_LOCAL_SESSION_TTL_MINUTES`
- `AUTH_SUPPORT_ACCESS_TTL_MINUTES`
- `AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS`
- `AUTH_PROVIDER_MODE`
- `AUTH_IDENTITY_BRIDGE_SECRET`
- `AUTH_IDENTITY_BRIDGE_PROVIDER`

`AUTH_SESSION_SIGNING_SECRET` is required in the API and web runtimes. `AUTH_IDENTITY_BRIDGE_SECRET` and `AUTH_IDENTITY_BRIDGE_PROVIDER` are required when `AUTH_PROVIDER_MODE=identity-bridge`.

## Local Session Behavior

- local session issuance is only allowed in `local` and `development`
- the web session route signs the cookie payload before storing it
- the API and web runtimes reject tampered or expired session tokens
- fallback default profiles remain limited to local and development

## Identity-Bridge Behavior

- identity-bridge assertions are carried through `x-atlas-auth-assertion`
- the API verifies the assertion signature and expiry before actor resolution
- the web runtime can forward identity-bridge assertions to internal API fetches
- local session issuance is disabled when the runtime is configured for `identity-bridge`

## Support-Access Behavior

- support access is initiated from `/operator/support-access`
- only buyer and seller tenants can be targeted
- a reason is required before a support session is issued
- support-access sessions carry both the principal operator identity and the target tenant identity
- support-access sessions are read-only at the API guard layer
- support-access issuance is allowed in production only when `AUTH_PROVIDER_MODE=identity-bridge`
- allowed support issuer emails can be limited through `AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS`
- every issued support session creates a persisted grant record
- support grants can be revoked explicitly before TTL expiry
- expired grants are marked expired when read

## Current Gaps

- no external identity provider or SSO exchange yet
- no formal access review or recertification process yet
- no external approval workflow for issuing support grants
- no session exchange with a production IdP yet

## Verification Commands

1. `pnpm --filter @atlas/auth test`
2. `pnpm --filter @atlas/api test -- --run test/actor.service.test.ts test/app.e2e.test.ts`
3. `pnpm --filter @atlas/web test -- --run src/app/auth/session/route.test.ts`
4. `pnpm verify:env`
5. `pnpm verify:release`

## Next Hardening Step

- replace the current identity-bridge intermediate path with a real auth-provider exchange boundary
- add stricter support-access review and approval workflows
- add formal access-review and recertification controls
