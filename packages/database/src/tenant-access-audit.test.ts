import type { AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import { createAtlasTenantAccessAuditEvent } from "./tenant-access-audit";

function createActor(): AtlasActorContext {
  return {
    user: {
      id: "user-1",
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
    sessionExpiresAt: "2026-04-12T08:00:00.000Z"
  };
}

describe("tenant access audit", () => {
  it("writes durable audit events with actor session context", async () => {
    const actor = createActor();
    const client = {
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    };

    await createAtlasTenantAccessAuditEvent(client as never, actor, {
      eventType: "analytics.platform_overview_inspected",
      targetType: "analytics_scope",
      targetId: actor.organization.id,
      payload: {
        surface: "platform_overview",
        resultCount: 4
      }
    });

    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId: actor.organization.id,
        userId: actor.user.id,
        actorType: "HUMAN",
        eventType: "analytics.platform_overview_inspected",
        targetType: "analytics_scope",
        targetId: actor.organization.id,
        payload: expect.objectContaining({
          surface: "platform_overview",
          resultCount: 4,
          workspace: "OPERATOR",
          organizationId: actor.organization.id,
          organizationSlug: actor.organization.slug,
          source: actor.source,
          providerMode: actor.providerMode,
          sessionId: actor.sessionId,
          supportAccessGrantId: null
        })
      }
    });
  });
});
