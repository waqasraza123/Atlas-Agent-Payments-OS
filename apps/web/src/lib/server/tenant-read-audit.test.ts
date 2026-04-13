import { describe, expect, it, vi } from "vitest";
import type { AtlasActorContext } from "@atlas/auth";
import { auditWorkspaceDetailInspection, auditWorkspaceSurfaceInspection } from "./tenant-read-audit";

function createActor(overrides: Partial<AtlasActorContext> = {}): AtlasActorContext {
  return {
    user: {
      id: "user-operator-1",
      email: "operator-admin@atlas.local",
      name: "Operator Admin"
    },
    organization: {
      id: "org-buyer-1",
      slug: "atlas-buyer",
      name: "Atlas Buyer",
      kind: "BUYER"
    },
    membership: {
      id: "membership-1",
      role: "ADMIN"
    },
    workspace: "BUYER",
    agentId: null,
    source: "internal-support",
    providerMode: "external-oidc",
    sessionId: "session-1",
    principalOrganization: {
      id: "org-operator-1",
      slug: "atlas-operator",
      name: "Atlas Operator",
      kind: "OPERATOR"
    },
    supportAccess: {
      grantId: "grant-support-1",
      mode: "read-only",
      targetWorkspace: "BUYER",
      targetOrganizationSlug: "atlas-buyer",
      grantedByUserEmail: "operator-admin@atlas.local",
      reason: "Investigate delayed settlement posture for this buyer tenant."
    },
    ...overrides
  };
}

describe("tenant read audit", () => {
  it("records support-session workspace surface inspections", async () => {
    const actor = createActor();
    const client = {
      auditEvent: {
        create: vi.fn()
      }
    };

    await auditWorkspaceSurfaceInspection(
      actor,
      {
        surfaceKey: "requests",
        primaryItemCount: 4,
        activityItemCount: 3
      },
      client as never
    );

    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: actor.organization.id,
        userId: actor.user.id,
        eventType: "support_access.workspace_surface_inspected",
        targetType: "tenant_workspace_surface",
        targetId: `${actor.organization.id}:requests`,
        payload: expect.objectContaining({
          surfaceKey: "requests",
          primaryItemCount: 4,
          activityItemCount: 3,
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-support-1"
        })
      })
    });
  });

  it("records support-session workspace detail inspections", async () => {
    const actor = createActor();
    const client = {
      auditEvent: {
        create: vi.fn()
      }
    };

    await auditWorkspaceDetailInspection(
      actor,
      {
        surfaceKey: "receipts",
        recordId: "receipt-1",
        title: "Invoice receipt"
      },
      client as never
    );

    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.workspace_detail_inspected",
        targetType: "tenant_workspace_record",
        targetId: "receipt-1",
        payload: expect.objectContaining({
          surfaceKey: "receipts",
          title: "Invoice receipt",
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-support-1"
        })
      })
    });
  });

  it("skips tenant read audit events for non-support actors", async () => {
    const actor = createActor({
      source: "identity-provider",
      supportAccess: null,
      principalOrganization: null
    });
    const client = {
      auditEvent: {
        create: vi.fn()
      }
    };

    await auditWorkspaceSurfaceInspection(
      actor,
      {
        surfaceKey: "overview",
        primaryItemCount: 2,
        activityItemCount: 2
      },
      client as never
    );
    await auditWorkspaceDetailInspection(
      actor,
      {
        surfaceKey: "requests",
        recordId: "request-1",
        title: "Blocked"
      },
      client as never
    );

    expect(client.auditEvent.create).not.toHaveBeenCalled();
  });
});
