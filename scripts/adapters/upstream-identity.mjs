import { createOperationId, readAtlasOperationPayload, readOptionalText, requireText, writeAdapterResult } from "./shared.mjs";

const payload = readAtlasOperationPayload();
const provider = requireText(payload.provider, "provider");
const action = requireText(payload.action, "action");
const actorUserEmail = requireText(payload.actorUserEmail, "actorUserEmail");
const assignmentId = requireText(payload.assignmentId, "assignmentId");
const externalEmail = requireText(payload.externalEmail, "externalEmail");
const organizationSlug = requireText(payload.organizationSlug, "organizationSlug");
const role = requireText(payload.role, "role");

if (provider === "okta-scim") {
  requireText(process.env.AUTH_OKTA_ORG_URL, "AUTH_OKTA_ORG_URL");
  requireText(process.env.AUTH_OKTA_SCIM_APP_ID, "AUTH_OKTA_SCIM_APP_ID");
}

if (provider === "auth0-management") {
  requireText(process.env.AUTH_AUTH0_DOMAIN, "AUTH_AUTH0_DOMAIN");
  requireText(process.env.AUTH_AUTH0_ORGANIZATION_ID, "AUTH_AUTH0_ORGANIZATION_ID");
}

const operationId = createOperationId(provider, payload);
const targetRef =
  provider === "okta-scim"
    ? `${process.env.AUTH_OKTA_ORG_URL}/api/v1/apps/${process.env.AUTH_OKTA_SCIM_APP_ID}/users/${encodeURIComponent(externalEmail)}`
    : provider === "auth0-management"
      ? `https://${process.env.AUTH_AUTH0_DOMAIN}/api/v2/organizations/${process.env.AUTH_AUTH0_ORGANIZATION_ID}/members/${encodeURIComponent(externalEmail)}`
      : `${organizationSlug}:${externalEmail}`;

writeAdapterResult({
  version: 1,
  adapter: provider === "okta-scim" ? "okta-scim-admin" : provider === "auth0-management" ? "auth0-management-api" : "generic-oidc-admin",
  provider,
  operationId,
  summary: `${action} ${externalEmail} for ${organizationSlug} as ${role} by ${actorUserEmail}.`,
  targetRef,
  metadata: {
    action,
    actorUserEmail,
    assignmentId,
    organizationSlug,
    role,
    externalEmail,
    providerDomain: readOptionalText(process.env.AUTH_OKTA_ORG_URL) ?? readOptionalText(process.env.AUTH_AUTH0_DOMAIN)
  }
});

