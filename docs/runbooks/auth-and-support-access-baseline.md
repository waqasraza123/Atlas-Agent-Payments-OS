# Auth And Support-Access Baseline

## Purpose

This runbook defines the current signed-session and internal support-access baseline after the rollout-hardening auth slice.

## Current Session Types

- signed local user session
- signed internal support-access session

Both session types are HMAC-signed and time-bounded. They are intended for local development and controlled internal support workflows, not as a substitute for a production identity provider.

## Runtime Requirements

- `AUTH_SESSION_SIGNING_SECRET`
- `AUTH_LOCAL_SESSION_TTL_MINUTES`
- `AUTH_SUPPORT_ACCESS_TTL_MINUTES`
- `AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS`

`AUTH_SESSION_SIGNING_SECRET` is required in the API and web runtimes.

## Local Session Behavior

- local session issuance is only allowed in `local` and `development`
- the web session route signs the cookie payload before storing it
- the API and web runtimes reject tampered or expired session tokens
- fallback default profiles remain limited to local and development

## Support-Access Behavior

- support access is initiated from `/operator/support-access`
- only buyer and seller tenants can be targeted
- a reason is required before a support session is issued
- support-access sessions carry both the principal operator identity and the target tenant identity
- support-access sessions are read-only at the API guard layer
- support-access issuance is blocked in production
- allowed support issuer emails can be limited through `AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS`

## Current Gaps

- no external identity provider or SSO exchange yet
- no persisted support-session issuance ledger yet
- no revoke workflow beyond session expiry and cookie replacement
- no formal access review or recertification process yet

## Verification Commands

1. `pnpm --filter @atlas/auth test`
2. `pnpm --filter @atlas/api test -- --run test/actor.service.test.ts test/app.e2e.test.ts`
3. `pnpm --filter @atlas/web test -- --run src/app/auth/session/route.test.ts`
4. `pnpm verify:env`

## Next Hardening Step

- replace internal-only signed session assumptions with a real auth-provider boundary
- persist support-session issuance and revocation history
- add stricter support-access review and audit workflows
