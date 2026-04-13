import type { AtlasActorContext } from "@atlas/auth";
import { createAtlasTenantAccessAuditEvent, prisma, type Prisma, type PrismaClient } from "@atlas/database";
import type { AtlasWorkspaceSurfaceKey } from "@atlas/domain";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

function isSupportTenantReadActor(actor: AtlasActorContext) {
  return actor.source === "internal-support" && actor.supportAccess !== null && actor.principalOrganization !== null;
}

function createSupportAuditPayload(actor: AtlasActorContext) {
  return {
    supportReason: actor.supportAccess?.reason ?? null,
    supportGrantId: actor.supportAccess?.grantId ?? null,
    principalOrganizationSlug: actor.principalOrganization?.slug ?? null
  } satisfies Prisma.JsonObject;
}

export async function auditWorkspaceSurfaceInspection(
  actor: AtlasActorContext,
  input: {
    surfaceKey: AtlasWorkspaceSurfaceKey;
    primaryItemCount: number;
    activityItemCount: number;
  },
  client: DatabaseClient = prisma
) {
  if (!isSupportTenantReadActor(actor)) {
    return;
  }

  await createAtlasTenantAccessAuditEvent(client, actor, {
    eventType: "support_access.workspace_surface_inspected",
    targetType: "tenant_workspace_surface",
    targetId: `${actor.organization.id}:${input.surfaceKey}`,
    payload: {
      ...createSupportAuditPayload(actor),
      surfaceKey: input.surfaceKey,
      primaryItemCount: input.primaryItemCount,
      activityItemCount: input.activityItemCount
    }
  });
}

export async function auditWorkspaceDetailInspection(
  actor: AtlasActorContext,
  input: {
    surfaceKey: AtlasWorkspaceSurfaceKey;
    recordId: string;
    title: string;
  },
  client: DatabaseClient = prisma
) {
  if (!isSupportTenantReadActor(actor)) {
    return;
  }

  await createAtlasTenantAccessAuditEvent(client, actor, {
    eventType: "support_access.workspace_detail_inspected",
    targetType: "tenant_workspace_record",
    targetId: input.recordId,
    payload: {
      ...createSupportAuditPayload(actor),
      surfaceKey: input.surfaceKey,
      title: input.title
    }
  });
}
