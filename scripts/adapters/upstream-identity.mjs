import {
  createOperationId,
  readAtlasOperationPayload,
  readOptionalText,
  requireText,
  shouldSimulateExternalExecution,
  writeAdapterResult
} from "./shared.mjs";

const payload = readAtlasOperationPayload();
const provider = requireText(payload.provider, "provider");
const action = requireText(payload.action, "action");
const actorUserEmail = requireText(payload.actorUserEmail, "actorUserEmail");
const assignmentId = requireText(payload.assignmentId, "assignmentId");
const externalEmail = requireText(payload.externalEmail, "externalEmail");
const organizationSlug = requireText(payload.organizationSlug, "organizationSlug");
const role = requireText(payload.role, "role");
const userName = readOptionalText(payload.userName);
const providerSubject = readOptionalText(payload.providerSubject);
const upstreamUserId = readOptionalText(payload.upstreamUserId);
const upstreamAssignmentId = readOptionalText(payload.upstreamAssignmentId);
const upstreamTargetRef = readOptionalText(payload.upstreamTargetRef);

if (provider === "okta-scim") {
  requireText(process.env.AUTH_OKTA_ORG_URL, "AUTH_OKTA_ORG_URL");
  requireText(process.env.AUTH_OKTA_SCIM_APP_ID, "AUTH_OKTA_SCIM_APP_ID");
  requireText(process.env.AUTH_OKTA_API_TOKEN, "AUTH_OKTA_API_TOKEN");
}

if (provider === "auth0-management") {
  requireText(process.env.AUTH_AUTH0_DOMAIN, "AUTH_AUTH0_DOMAIN");
  requireText(process.env.AUTH_AUTH0_ORGANIZATION_ID, "AUTH_AUTH0_ORGANIZATION_ID");
  requireText(process.env.AUTH_AUTH0_MANAGEMENT_API_TOKEN, "AUTH_AUTH0_MANAGEMENT_API_TOKEN");
}

const simulated = shouldSimulateExternalExecution();
const operationId = createOperationId(provider, payload);

function normalizeBaseUrl(value, protocol = "https:") {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/+$/, "");
  }

  return `${protocol}//${value.replace(/\/+$/, "")}`;
}

function buildTargetRef(resolvedProvider, resolvedUserId) {
  if (resolvedProvider === "okta-scim") {
    return `${normalizeBaseUrl(process.env.AUTH_OKTA_ORG_URL)}/api/v1/apps/${process.env.AUTH_OKTA_SCIM_APP_ID}/users/${encodeURIComponent(resolvedUserId)}`;
  }

  if (resolvedProvider === "auth0-management") {
    return `${normalizeBaseUrl(process.env.AUTH_AUTH0_DOMAIN)}/api/v2/organizations/${process.env.AUTH_AUTH0_ORGANIZATION_ID}/members/${encodeURIComponent(resolvedUserId)}`;
  }

  return upstreamTargetRef ?? `${organizationSlug}:${externalEmail}`;
}

function buildOktaHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `SSWS ${process.env.AUTH_OKTA_API_TOKEN}`
  };
}

function buildAuth0Headers() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.AUTH_AUTH0_MANAGEMENT_API_TOKEN}`
  };
}

async function executeRequest(url, init = {}) {
  const response = await fetch(url, init);
  const bodyText = await response.text();
  const parsed =
    bodyText.length > 0 && response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(bodyText)
      : bodyText;

  return {
    ok: response.ok,
    status: response.status,
    body: parsed,
    text: bodyText
  };
}

function readResponseError(result, label) {
  const bodyText =
    typeof result.body === "string"
      ? result.body
      : result.body && typeof result.body === "object"
        ? JSON.stringify(result.body)
        : result.text;

  throw new Error(`${label} failed with ${result.status}: ${bodyText.slice(0, 1200)}`);
}

function splitName(value) {
  const normalized = (value ?? "").trim();
  const fallbackLocalPart = externalEmail.split("@")[0] ?? "atlas";

  if (normalized.length === 0) {
    return {
      firstName: fallbackLocalPart,
      lastName: "User"
    };
  }

  const parts = normalized.split(/\s+/).filter((entry) => entry.length > 0);
  return {
    firstName: parts[0] ?? fallbackLocalPart,
    lastName: parts.slice(1).join(" ") || "User"
  };
}

async function resolveOktaUser() {
  const orgUrl = normalizeBaseUrl(process.env.AUTH_OKTA_ORG_URL);
  const candidateIds = [upstreamUserId, providerSubject].filter(Boolean);

  for (const candidateId of candidateIds) {
    const byId = await executeRequest(`${orgUrl}/api/v1/users/${encodeURIComponent(candidateId)}`, {
      method: "GET",
      headers: buildOktaHeaders()
    });

    if (byId.ok && byId.body && typeof byId.body === "object") {
      return byId.body;
    }

    if (byId.status !== 404) {
      readResponseError(byId, `Okta user lookup for ${candidateId}`);
    }
  }

  const search = encodeURIComponent(`profile.login eq "${externalEmail}"`);
  const byEmail = await executeRequest(`${orgUrl}/api/v1/users?search=${search}&limit=1`, {
    method: "GET",
    headers: buildOktaHeaders()
  });

  if (!byEmail.ok) {
    readResponseError(byEmail, `Okta user search for ${externalEmail}`);
  }

  return Array.isArray(byEmail.body) && byEmail.body.length > 0 ? byEmail.body[0] : null;
}

async function createOktaUser() {
  const orgUrl = normalizeBaseUrl(process.env.AUTH_OKTA_ORG_URL);
  const { firstName, lastName } = splitName(userName);
  const created = await executeRequest(`${orgUrl}/api/v1/users?activate=false`, {
    method: "POST",
    headers: buildOktaHeaders(),
    body: JSON.stringify({
      profile: {
        firstName,
        lastName,
        email: externalEmail,
        login: externalEmail
      }
    })
  });

  if (!created.ok) {
    readResponseError(created, `Okta user creation for ${externalEmail}`);
  }

  return created.body;
}

async function loadOktaAppUser(userId) {
  const orgUrl = normalizeBaseUrl(process.env.AUTH_OKTA_ORG_URL);
  const appUser = await executeRequest(
    `${orgUrl}/api/v1/apps/${process.env.AUTH_OKTA_SCIM_APP_ID}/users/${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: buildOktaHeaders()
    }
  );

  if (appUser.ok) {
    return appUser.body;
  }

  if (appUser.status === 404) {
    return null;
  }

  readResponseError(appUser, `Okta application user lookup for ${userId}`);
}

async function ensureOktaAppUser(userId) {
  const existing = await loadOktaAppUser(userId);

  if (existing) {
    return {
      appUser: existing,
      changed: false
    };
  }

  const orgUrl = normalizeBaseUrl(process.env.AUTH_OKTA_ORG_URL);
  const assigned = await executeRequest(`${orgUrl}/api/v1/apps/${process.env.AUTH_OKTA_SCIM_APP_ID}/users`, {
    method: "POST",
    headers: buildOktaHeaders(),
    body: JSON.stringify({
      id: userId
    })
  });

  if (!assigned.ok) {
    readResponseError(assigned, `Okta application assignment for ${userId}`);
  }

  return {
    appUser: assigned.body,
    changed: true
  };
}

async function removeOktaAppUser(userId) {
  const existing = await loadOktaAppUser(userId);

  if (!existing) {
    return false;
  }

  const orgUrl = normalizeBaseUrl(process.env.AUTH_OKTA_ORG_URL);
  const removed = await executeRequest(
    `${orgUrl}/api/v1/apps/${process.env.AUTH_OKTA_SCIM_APP_ID}/users/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: buildOktaHeaders()
    }
  );

  if (!removed.ok && removed.status !== 404) {
    readResponseError(removed, `Okta application unassignment for ${userId}`);
  }

  return true;
}

async function executeOktaLifecycle() {
  if (simulated) {
    const resolvedUserId = upstreamUserId ?? providerSubject ?? externalEmail;

    return {
      summary: `${action} ${externalEmail} for ${organizationSlug} as ${role} by ${actorUserEmail}.`,
      targetRef: buildTargetRef(provider, resolvedUserId),
      metadata: {
        action,
        actorUserEmail,
        assignmentId,
        organizationSlug,
        role,
        externalEmail,
        executionMode: "simulated",
        providerSubject: resolvedUserId,
        upstreamUserId: resolvedUserId,
        upstreamAssignmentId: `${process.env.AUTH_OKTA_SCIM_APP_ID}:${resolvedUserId}`,
        upstreamStatus: action === "REVOKE" ? "REVOKED" : action === "SUSPEND" ? "SUSPENDED" : "ACTIVE",
        userCreated: !upstreamUserId && !providerSubject,
        assignmentChanged: true
      }
    };
  }

  let user = await resolveOktaUser();
  let userCreated = false;

  if (!user && (action === "PROVISION" || action === "REACTIVATE")) {
    user = await createOktaUser();
    userCreated = true;
  }

  if (!user) {
    if (action === "SUSPEND" || action === "REVOKE") {
      return {
        summary: `${action} ${externalEmail} for ${organizationSlug} as ${role} by ${actorUserEmail}. Upstream user already absent.`,
        targetRef: upstreamTargetRef ?? `${normalizeBaseUrl(process.env.AUTH_OKTA_ORG_URL)}/api/v1/apps/${process.env.AUTH_OKTA_SCIM_APP_ID}`,
        metadata: {
          action,
          actorUserEmail,
          assignmentId,
          organizationSlug,
          role,
          externalEmail,
          executionMode: simulated ? "simulated" : "live",
          providerSubject: providerSubject ?? null,
          upstreamUserId: upstreamUserId ?? null,
          upstreamAssignmentId: upstreamAssignmentId ?? null,
          upstreamStatus: action === "REVOKE" ? "REVOKED" : "SUSPENDED",
          userCreated: false,
          assignmentChanged: false
        }
      };
    }

    throw new Error(`Okta could not resolve or create the upstream user for ${externalEmail}.`);
  }

  const resolvedUserId = String(user.id);

  if (action === "PROVISION" || action === "REACTIVATE") {
    const result = await ensureOktaAppUser(resolvedUserId);

    return {
      summary: `${action} ${externalEmail} for ${organizationSlug} as ${role} by ${actorUserEmail}.`,
      targetRef: buildTargetRef(provider, resolvedUserId),
      metadata: {
        action,
        actorUserEmail,
        assignmentId,
        organizationSlug,
        role,
        externalEmail,
        executionMode: "live",
        providerSubject: resolvedUserId,
        upstreamUserId: resolvedUserId,
        upstreamAssignmentId: `${process.env.AUTH_OKTA_SCIM_APP_ID}:${resolvedUserId}`,
        upstreamStatus: "ACTIVE",
        userCreated,
        assignmentChanged: result.changed
      }
    };
  }

  const removed = await removeOktaAppUser(resolvedUserId);

  return {
    summary: `${action} ${externalEmail} for ${organizationSlug} as ${role} by ${actorUserEmail}.`,
    targetRef: buildTargetRef(provider, resolvedUserId),
    metadata: {
      action,
      actorUserEmail,
      assignmentId,
      organizationSlug,
      role,
      externalEmail,
      executionMode: "live",
      providerSubject: resolvedUserId,
      upstreamUserId: resolvedUserId,
      upstreamAssignmentId: `${process.env.AUTH_OKTA_SCIM_APP_ID}:${resolvedUserId}`,
      upstreamStatus: action === "REVOKE" ? "REVOKED" : "SUSPENDED",
      userCreated,
      assignmentChanged: removed
    }
  };
}

async function resolveAuth0User() {
  const domain = normalizeBaseUrl(process.env.AUTH_AUTH0_DOMAIN);
  const candidateIds = [upstreamUserId, providerSubject].filter(Boolean);

  for (const candidateId of candidateIds) {
    const byId = await executeRequest(`${domain}/api/v2/users/${encodeURIComponent(candidateId)}`, {
      method: "GET",
      headers: buildAuth0Headers()
    });

    if (byId.ok && byId.body && typeof byId.body === "object") {
      return byId.body;
    }

    if (byId.status !== 404) {
      readResponseError(byId, `Auth0 user lookup for ${candidateId}`);
    }
  }

  const byEmail = await executeRequest(`${domain}/api/v2/users-by-email?email=${encodeURIComponent(externalEmail)}`, {
    method: "GET",
    headers: buildAuth0Headers()
  });

  if (!byEmail.ok) {
    readResponseError(byEmail, `Auth0 user search for ${externalEmail}`);
  }

  return Array.isArray(byEmail.body) && byEmail.body.length > 0 ? byEmail.body[0] : null;
}

async function addAuth0OrganizationMember(userId) {
  const domain = normalizeBaseUrl(process.env.AUTH_AUTH0_DOMAIN);
  const added = await executeRequest(`${domain}/api/v2/organizations/${process.env.AUTH_AUTH0_ORGANIZATION_ID}/members`, {
    method: "POST",
    headers: buildAuth0Headers(),
    body: JSON.stringify({
      members: [userId]
    })
  });

  if (!added.ok && added.status !== 409) {
    readResponseError(added, `Auth0 organization membership add for ${userId}`);
  }

  return added.status !== 409;
}

async function removeAuth0OrganizationMember(userId) {
  const domain = normalizeBaseUrl(process.env.AUTH_AUTH0_DOMAIN);
  const removed = await executeRequest(`${domain}/api/v2/organizations/${process.env.AUTH_AUTH0_ORGANIZATION_ID}/members`, {
    method: "DELETE",
    headers: buildAuth0Headers(),
    body: JSON.stringify({
      members: [userId]
    })
  });

  if (!removed.ok && removed.status !== 404) {
    readResponseError(removed, `Auth0 organization membership removal for ${userId}`);
  }

  return removed.ok;
}

async function executeAuth0Lifecycle() {
  if (simulated) {
    const resolvedUserId = upstreamUserId ?? providerSubject ?? externalEmail;

    return {
      summary: `${action} ${externalEmail} for ${organizationSlug} as ${role} by ${actorUserEmail}.`,
      targetRef: buildTargetRef(provider, resolvedUserId),
      metadata: {
        action,
        actorUserEmail,
        assignmentId,
        organizationSlug,
        role,
        externalEmail,
        executionMode: "simulated",
        providerSubject: resolvedUserId,
        upstreamUserId: resolvedUserId,
        upstreamAssignmentId: `${process.env.AUTH_AUTH0_ORGANIZATION_ID}:${resolvedUserId}`,
        upstreamStatus: action === "REVOKE" ? "REVOKED" : action === "SUSPEND" ? "SUSPENDED" : "ACTIVE",
        assignmentChanged: true
      }
    };
  }

  const user = await resolveAuth0User();

  if (!user) {
    if (action === "SUSPEND" || action === "REVOKE") {
      return {
        summary: `${action} ${externalEmail} for ${organizationSlug} as ${role} by ${actorUserEmail}. Upstream user already absent.`,
        targetRef:
          upstreamTargetRef ??
          `${normalizeBaseUrl(process.env.AUTH_AUTH0_DOMAIN)}/api/v2/organizations/${process.env.AUTH_AUTH0_ORGANIZATION_ID}`,
        metadata: {
          action,
          actorUserEmail,
          assignmentId,
          organizationSlug,
          role,
          externalEmail,
          executionMode: simulated ? "simulated" : "live",
          providerSubject: providerSubject ?? null,
          upstreamUserId: upstreamUserId ?? null,
          upstreamAssignmentId: upstreamAssignmentId ?? null,
          upstreamStatus: action === "REVOKE" ? "REVOKED" : "SUSPENDED",
          assignmentChanged: false
        }
      };
    }

    throw new Error(`Auth0 could not resolve an upstream user for ${externalEmail}.`);
  }

  const resolvedUserId = String(user.user_id);

  if (action === "PROVISION" || action === "REACTIVATE") {
    const changed = await addAuth0OrganizationMember(resolvedUserId);

    return {
      summary: `${action} ${externalEmail} for ${organizationSlug} as ${role} by ${actorUserEmail}.`,
      targetRef: buildTargetRef(provider, resolvedUserId),
      metadata: {
        action,
        actorUserEmail,
        assignmentId,
        organizationSlug,
        role,
        externalEmail,
        executionMode: "live",
        providerSubject: resolvedUserId,
        upstreamUserId: resolvedUserId,
        upstreamAssignmentId: `${process.env.AUTH_AUTH0_ORGANIZATION_ID}:${resolvedUserId}`,
        upstreamStatus: "ACTIVE",
        assignmentChanged: changed
      }
    };
  }

  const changed = await removeAuth0OrganizationMember(resolvedUserId);

  return {
    summary: `${action} ${externalEmail} for ${organizationSlug} as ${role} by ${actorUserEmail}.`,
    targetRef: buildTargetRef(provider, resolvedUserId),
    metadata: {
      action,
      actorUserEmail,
      assignmentId,
      organizationSlug,
      role,
      externalEmail,
      executionMode: "live",
      providerSubject: resolvedUserId,
      upstreamUserId: resolvedUserId,
      upstreamAssignmentId: `${process.env.AUTH_AUTH0_ORGANIZATION_ID}:${resolvedUserId}`,
      upstreamStatus: action === "REVOKE" ? "REVOKED" : "SUSPENDED",
      assignmentChanged: changed
    }
  };
}

const result =
  provider === "okta-scim"
    ? await executeOktaLifecycle()
    : provider === "auth0-management"
      ? await executeAuth0Lifecycle()
      : {
          summary: `${action} ${externalEmail} for ${organizationSlug} as ${role} by ${actorUserEmail}.`,
          targetRef: upstreamTargetRef ?? `${organizationSlug}:${externalEmail}`,
          metadata: {
            action,
            actorUserEmail,
            assignmentId,
            organizationSlug,
            role,
            externalEmail,
            executionMode: simulated ? "simulated" : "live",
            providerSubject: providerSubject ?? null,
            upstreamUserId: upstreamUserId ?? null,
            upstreamAssignmentId: upstreamAssignmentId ?? null,
            upstreamStatus: action === "REVOKE" ? "REVOKED" : action === "SUSPEND" ? "SUSPENDED" : "ACTIVE"
          }
        };

writeAdapterResult({
  version: 1,
  adapter: provider === "okta-scim" ? "okta-scim-admin" : provider === "auth0-management" ? "auth0-management-api" : "generic-oidc-admin",
  provider,
  operationId,
  summary: result.summary,
  targetRef: result.targetRef,
  metadata: {
    ...result.metadata,
    providerDomain: readOptionalText(process.env.AUTH_OKTA_ORG_URL) ?? readOptionalText(process.env.AUTH_AUTH0_DOMAIN)
  }
});
