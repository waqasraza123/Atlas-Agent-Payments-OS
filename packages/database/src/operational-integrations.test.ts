import type { AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import {
  AtlasOperationalIntegrationWorkflowError,
  registerOperationalIntegration,
  resolveOperationalIntegrationForExecution,
  updateOperationalIntegrationVerification
} from "./operational-integrations";

function createOperatorActor(overrides?: Partial<AtlasActorContext>): AtlasActorContext {
  return {
    user: {
      id: "user-operator",
      email: "operator-admin@atlas.local",
      name: "Operator Admin"
    },
    organization: {
      id: "org-operator",
      slug: "atlas-demo-operator",
      name: "Atlas Demo Operator",
      kind: "OPERATOR"
    },
    membership: {
      id: "membership-operator",
      role: "ADMIN"
    },
    workspace: "OPERATOR",
    agentId: null,
    source: "external-oidc",
    providerMode: "external-oidc",
    sessionId: "session-1",
    principalOrganization: null,
    supportAccess: null,
    sessionIssuedAt: "2026-04-12T00:00:00.000Z",
    sessionExpiresAt: "2026-04-12T08:00:00.000Z",
    ...overrides
  };
}

describe("operational integrations workflow", () => {
  it("registers operational integrations for operator governance", async () => {
    const actor = createOperatorActor();
    const client = {
      operationalIntegration: {
        create: vi.fn(async () => ({
          id: "integration-1",
          kind: "DEPLOYMENT_AUTOMATION",
          targetEnvironment: "STAGING",
          provider: "github-actions",
          label: "staging github runner",
          ownerEmail: "platform-ops@atlas.local",
          endpointReference: "atlas/payments-os",
          secretReference: "aws-secrets://atlas/staging/deployer",
          configReference: "deploy-staging",
          status: "ACTIVE",
          verificationStatus: "PENDING",
          verificationReason: null,
          statusReason: null,
          metadata: null,
          lastVerifiedAt: null,
          lastUsedAt: null,
          createdAt: new Date("2026-04-12T00:00:00.000Z"),
          updatedAt: new Date("2026-04-12T00:00:00.000Z"),
          createdByUser: {
            email: actor.user.email
          },
          updatedByUser: null
        }))
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const integration = await registerOperationalIntegration(
      actor,
      {
        kind: "DEPLOYMENT_AUTOMATION",
        targetEnvironment: "STAGING",
        provider: "github-actions",
        label: "staging github runner",
        ownerEmail: "platform-ops@atlas.local",
        endpointReference: "atlas/payments-os",
        secretReference: "aws-secrets://atlas/staging/deployer",
        configReference: "deploy-staging"
      },
      client as never
    );

    expect(integration.provider).toBe("github-actions");
    expect(client.operationalIntegration.create).toHaveBeenCalled();
    expect(client.auditEvent.create).toHaveBeenCalled();
  });

  it("updates operational integration verification state", async () => {
    const actor = createOperatorActor();
    const client = {
      operationalIntegration: {
        findUnique: vi.fn(async () => ({
          id: "integration-1",
          kind: "SECRET_ROTATION",
          targetEnvironment: "STAGING",
          provider: "aws-secrets-manager",
          label: "staging rotation owner",
          ownerEmail: "platform-ops@atlas.local",
          endpointReference: "us-east-1",
          secretReference: "atlas/staging",
          configReference: null,
          status: "ACTIVE",
          verificationStatus: "PENDING",
          verificationReason: null,
          statusReason: null,
          metadata: null,
          lastVerifiedAt: null,
          lastUsedAt: null,
          createdAt: new Date("2026-04-12T00:00:00.000Z"),
          updatedAt: new Date("2026-04-12T00:00:00.000Z"),
          createdByUser: {
            email: actor.user.email
          },
          updatedByUser: null
        })),
        update: vi.fn(async () => ({
          id: "integration-1",
          kind: "SECRET_ROTATION",
          targetEnvironment: "STAGING",
          provider: "aws-secrets-manager",
          label: "staging rotation owner",
          ownerEmail: "platform-ops@atlas.local",
          endpointReference: "us-east-1",
          secretReference: "atlas/staging",
          configReference: null,
          status: "ACTIVE",
          verificationStatus: "VERIFIED",
          verificationReason: "Verified against the owned staging secret manager path.",
          statusReason: null,
          metadata: null,
          lastVerifiedAt: new Date("2026-04-12T01:00:00.000Z"),
          lastUsedAt: null,
          createdAt: new Date("2026-04-12T00:00:00.000Z"),
          updatedAt: new Date("2026-04-12T01:00:00.000Z"),
          createdByUser: {
            email: actor.user.email
          },
          updatedByUser: {
            email: actor.user.email
          }
        }))
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const integration = await updateOperationalIntegrationVerification(
      actor,
      "integration-1",
      {
        verificationStatus: "VERIFIED",
        verificationReason: "Verified against the owned staging secret manager path."
      },
      client as never
    );

    expect(integration.verificationStatus).toBe("VERIFIED");
    expect(client.operationalIntegration.update).toHaveBeenCalled();
  });

  it("rejects command execution when no verified owned target exists", async () => {
    const client = {
      operationalIntegration: {
        findMany: vi.fn(async () => [])
      }
    } as const;

    await expect(
      resolveOperationalIntegrationForExecution(
        {
          kind: "UPSTREAM_IDENTITY",
          targetEnvironment: "STAGING",
          provider: "okta-scim"
        },
        client as never
      )
    ).rejects.toBeInstanceOf(AtlasOperationalIntegrationWorkflowError);
  });
});
