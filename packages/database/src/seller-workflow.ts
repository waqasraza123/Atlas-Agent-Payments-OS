import type { AtlasActorContext } from "@atlas/auth";
import {
  atlasSellerServiceCreateSchema,
  atlasSellerServiceUpdateSchema,
  type AtlasSellerProfileRecord,
  type AtlasSellerRequestRecord,
  type AtlasSellerServiceRecord,
  type AtlasSellerTeamMemberRecord
} from "@atlas/domain";
import { ZodError } from "zod";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";

export class AtlasSellerWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "not_found" | "conflict" | "forbidden"
  ) {
    super(message);
    this.name = "AtlasSellerWorkflowError";
  }
}

function normalizeValidationError(error: unknown): never {
  if (error instanceof AtlasSellerWorkflowError) {
    throw error;
  }

  if (error instanceof ZodError) {
    throw new AtlasSellerWorkflowError(error.issues.map((issue) => issue.message).join("; "), "bad_request");
  }

  throw error;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

type ServiceWithRequestCount = {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string;
  category: string;
  status: string;
  visibility: string;
  pricingModel: string;
  priceMinor: number;
  currency: string;
  linkedRequestCount?: number;
};

function mapSellerServiceRecord(service: ServiceWithRequestCount): AtlasSellerServiceRecord {
  return {
    id: service.id,
    organizationId: service.organizationId,
    key: service.key,
    name: service.name,
    description: service.description,
    category: service.category,
    status: service.status as AtlasSellerServiceRecord["status"],
    visibility: service.visibility as AtlasSellerServiceRecord["visibility"],
    pricingModel: service.pricingModel as AtlasSellerServiceRecord["pricingModel"],
    priceMinor: service.priceMinor,
    currency: service.currency,
    linkedRequestCount: service.linkedRequestCount ?? 0
  };
}

function extractServiceKey(request: {
  serviceKey: string | null;
  requestPayload: Prisma.JsonValue;
}) {
  if (request.serviceKey) {
    return request.serviceKey;
  }

  if (
    request.requestPayload &&
    typeof request.requestPayload === "object" &&
    !Array.isArray(request.requestPayload) &&
    typeof (request.requestPayload as Record<string, unknown>).serviceKey === "string"
  ) {
    return (request.requestPayload as Record<string, string>).serviceKey;
  }

  return null;
}

async function createAuditEvent(
  transaction: Prisma.TransactionClient,
  actor: AtlasActorContext,
  input: {
    targetType: string;
    targetId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
    requestId?: string | null;
  }
) {
  await transaction.auditEvent.create({
    data: {
      organizationId: actor.organization.id,
      userId: actor.user.id,
      actorType: "HUMAN",
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId,
      requestId: input.requestId ?? null,
      payload: input.payload
    }
  });
}

export async function getSellerProfile(
  organizationId: string,
  client: PrismaClient | Prisma.TransactionClient = prisma
): Promise<AtlasSellerProfileRecord> {
  const [organization, servicesCount, publishedServicesCount, requestCount, activeBuyerCount] = await Promise.all([
    client.organization.findFirst({
      where: {
        id: organizationId,
        kind: "SELLER"
      }
    }),
    client.service.count({
      where: {
        organizationId
      }
    }),
    client.service.count({
      where: {
        organizationId,
        status: "PUBLISHED"
      }
    }),
    client.spendRequest.count({
      where: {
        sellerOrganizationId: organizationId
      }
    }),
    client.spendRequest
      .findMany({
        where: {
          sellerOrganizationId: organizationId
        },
        select: {
          organizationId: true
        },
        distinct: ["organizationId"]
      })
      .then((records) => records.length)
  ]);

  if (!organization) {
    throw new AtlasSellerWorkflowError("The current seller organization could not be resolved.", "not_found");
  }

  return {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    organizationName: organization.name,
    serviceCount: servicesCount,
    publishedServiceCount: publishedServicesCount,
    requestCount,
    activeBuyerCount
  };
}

export async function listSellerTeamMembers(
  organizationId: string,
  client: PrismaClient | Prisma.TransactionClient = prisma
): Promise<AtlasSellerTeamMemberRecord[]> {
  const memberships = await client.membership.findMany({
    where: {
      organizationId
    },
    include: {
      user: true
    },
    orderBy: [
      {
        role: "asc"
      },
      {
        user: {
          email: "asc"
        }
      }
    ]
  });

  return memberships.map((membership) => ({
    membershipId: membership.id,
    userId: membership.user.id,
    userEmail: membership.user.email,
    userName: membership.user.name,
    role: membership.role
  }));
}

export async function listSellerServices(
  organizationId: string,
  client: PrismaClient | Prisma.TransactionClient = prisma
): Promise<AtlasSellerServiceRecord[]> {
  const [services, requests] = await Promise.all([
    client.service.findMany({
      where: {
        organizationId
      },
      orderBy: [
        {
          status: "asc"
        },
        {
          createdAt: "desc"
        }
      ]
    }),
    client.spendRequest.findMany({
      where: {
        sellerOrganizationId: organizationId
      },
      select: {
        serviceKey: true,
        requestPayload: true
      }
    })
  ]);

  const requestCountByServiceKey = new Map<string, number>();

  for (const request of requests) {
    const serviceKey = extractServiceKey(request);
    if (!serviceKey) {
      continue;
    }

    requestCountByServiceKey.set(serviceKey, (requestCountByServiceKey.get(serviceKey) ?? 0) + 1);
  }

  return services.map((service) =>
    mapSellerServiceRecord({
      ...service,
      linkedRequestCount: requestCountByServiceKey.get(service.key) ?? 0
    })
  );
}

export async function createSellerService(actor: AtlasActorContext, rawInput: unknown): Promise<AtlasSellerServiceRecord> {
  try {
    const input = atlasSellerServiceCreateSchema.parse(rawInput);
    const service = await prisma.service.create({
      data: {
        organizationId: actor.organization.id,
        key: input.key,
        name: input.name,
        description: input.description,
        category: input.category,
        status: input.status,
        visibility: input.visibility,
        pricingModel: input.pricingModel,
        priceMinor: input.priceMinor,
        currency: input.currency
      },
    });

    await prisma.auditEvent.create({
      data: {
        organizationId: actor.organization.id,
        userId: actor.user.id,
        actorType: "HUMAN",
        eventType: "seller_service_created",
        targetType: "Service",
        targetId: service.id,
        payload: {
          key: service.key,
          status: service.status,
          priceMinor: service.priceMinor,
          currency: service.currency
        }
      }
    });

    return mapSellerServiceRecord(service);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AtlasSellerWorkflowError("A seller service with this key already exists in the current organization.", "conflict");
    }

    normalizeValidationError(error);
  }
}

export async function updateSellerService(
  actor: AtlasActorContext,
  serviceId: string,
  rawInput: unknown
): Promise<AtlasSellerServiceRecord> {
  try {
    const input = atlasSellerServiceUpdateSchema.parse(rawInput);
    const current = await prisma.service.findFirst({
      where: {
        id: serviceId,
        organizationId: actor.organization.id
      }
    });

    if (!current) {
      throw new AtlasSellerWorkflowError("The selected seller service is not available in this organization.", "not_found");
    }

    const updated = await prisma.service.update({
      where: {
        id: current.id
      },
      data: {
        key: input.key ?? undefined,
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        category: input.category ?? undefined,
        status: input.status ?? undefined,
        visibility: input.visibility ?? undefined,
        pricingModel: input.pricingModel ?? undefined,
        priceMinor: input.priceMinor ?? undefined,
        currency: input.currency ?? undefined
      },
    });

    await prisma.auditEvent.create({
      data: {
        organizationId: actor.organization.id,
        userId: actor.user.id,
        actorType: "HUMAN",
        eventType: "seller_service_updated",
        targetType: "Service",
        targetId: updated.id,
        payload: {
          key: updated.key,
          status: updated.status,
          visibility: updated.visibility,
          priceMinor: updated.priceMinor,
          currency: updated.currency
        }
      }
    });

    return mapSellerServiceRecord(updated);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AtlasSellerWorkflowError("A seller service with this key already exists in the current organization.", "conflict");
    }

    normalizeValidationError(error);
  }
}

export async function getSellerService(
  organizationId: string,
  serviceId: string,
  client: PrismaClient | Prisma.TransactionClient = prisma
): Promise<AtlasSellerServiceRecord | null> {
  const service = await client.service.findFirst({
    where: {
      id: serviceId,
      organizationId
    }
  });

  if (!service) {
    return null;
  }

  const linkedRequestCount = await client.spendRequest.count({
    where: {
      sellerOrganizationId: organizationId,
      serviceKey: service.key
    }
  });

  return mapSellerServiceRecord({
    ...service,
    linkedRequestCount
  });
}

export async function listSellerRequests(
  organizationId: string,
  client: PrismaClient | Prisma.TransactionClient = prisma
): Promise<AtlasSellerRequestRecord[]> {
  const [services, requests] = await Promise.all([
    client.service.findMany({
      where: {
        organizationId
      },
      select: {
        id: true,
        key: true,
        name: true
      }
    }),
    client.spendRequest.findMany({
      where: {
        sellerOrganizationId: organizationId
      },
      include: {
        organization: true
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  ]);

  const serviceMap = new Map(services.map((service) => [service.key, service]));

  return requests.map((request) => {
    const serviceKey = extractServiceKey(request);
    const matchedService = serviceKey ? serviceMap.get(serviceKey) ?? null : null;

    return {
      id: request.id,
      buyerOrganizationId: request.organization.id,
      buyerOrganizationName: request.organization.name,
      title: request.title,
      purpose: request.purpose,
      amountMinor: request.amountMinor,
      currency: request.currency,
      serviceCategory: request.serviceCategory,
      serviceKey,
      matchedServiceId: matchedService?.id ?? null,
      matchedServiceName: matchedService?.name ?? null,
      status: request.status,
      createdAt: request.createdAt.toISOString()
    };
  });
}

export async function getSellerRequest(
  organizationId: string,
  requestId: string,
  client: PrismaClient | Prisma.TransactionClient = prisma
): Promise<AtlasSellerRequestRecord | null> {
  const requests = await listSellerRequests(organizationId, client);
  return requests.find((request) => request.id === requestId) ?? null;
}
