import type { AtlasActorContext } from "@atlas/auth";
import { Prisma, type PrismaClient } from "./generated/client/index.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

function createAuditPayload(actor: AtlasActorContext, payload: Prisma.JsonObject) {
  return {
    ...payload,
    workspace: actor.workspace,
    organizationId: actor.organization.id,
    organizationSlug: actor.organization.slug,
    source: actor.source,
    providerMode: actor.providerMode,
    sessionId: actor.sessionId,
    principalOrganizationId: actor.principalOrganization?.id ?? null,
    supportAccessGrantId: actor.supportAccess?.grantId ?? null
  } satisfies Prisma.JsonObject;
}

export async function createAtlasTenantAccessAuditEvent(
  client: DatabaseClient,
  actor: AtlasActorContext,
  input: {
    eventType: string;
    targetType: string;
    targetId: string;
    payload: Prisma.JsonObject;
  }
) {
  if (!("auditEvent" in client) || typeof client.auditEvent?.create !== "function") {
    return;
  }

  await client.auditEvent.create({
    data: {
      organizationId: actor.organization.id,
      userId: actor.user.id,
      actorType: "HUMAN",
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId,
      payload: createAuditPayload(actor, input.payload)
    }
  });
}
