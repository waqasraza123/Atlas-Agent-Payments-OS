import { canAtlasActorMutate, type AtlasActorContext } from "@atlas/auth";
import {
  atlasSellerRequestFulfillmentSchema,
  atlasSellerServiceCreateSchema,
  atlasSellerServiceUpdateSchema,
  isAtlasSellerPendingFulfillmentStatus,
  isAtlasSellerRequestFulfillmentAllowed,
  isAtlasSellerTerminalRequestStatus,
  type AtlasSellerAnalyticsRecord,
  type AtlasSellerProfileRecord,
  type AtlasSellerRequestFulfillmentRecord,
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

function assertSellerMutationActor(actor: AtlasActorContext) {
  if (!canAtlasActorMutate(actor)) {
    throw new AtlasSellerWorkflowError("Support-access sessions are limited to read-only seller routes.", "forbidden");
  }
}

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

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

type SellerServiceMatcher = {
  id: string;
  key: string;
  name: string;
};

type SellerRequestRow = {
  id: string;
  organizationId: string;
  title: string;
  purpose: string;
  amountMinor: number;
  currency: string;
  serviceCategory: string;
  serviceKey: string | null;
  status: string;
  requestPayload: Prisma.JsonValue;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
  };
};

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

function asJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

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

function parseSellerFulfillment(metadata: Prisma.JsonValue | null): AtlasSellerRequestFulfillmentRecord | null {
  const metadataObject = asJsonObject(metadata);
  const fulfillmentObject =
    metadataObject?.sellerFulfillment &&
    typeof metadataObject.sellerFulfillment === "object" &&
    !Array.isArray(metadataObject.sellerFulfillment)
      ? (metadataObject.sellerFulfillment as Record<string, unknown>)
      : null;

  if (!fulfillmentObject) {
    return null;
  }

  const fulfillmentStatus = fulfillmentObject.fulfillmentStatus;
  const note = fulfillmentObject.note;
  const recordedAt = fulfillmentObject.recordedAt;

  if (
    (fulfillmentStatus === "DELIVERED" || fulfillmentStatus === "FAILED") &&
    typeof note === "string" &&
    note.trim().length > 0 &&
    typeof recordedAt === "string" &&
    recordedAt.trim().length > 0
  ) {
    return {
      fulfillmentStatus,
      note,
      recordedAt
    };
  }

  return null;
}

function mapSellerRequestRecord(
  request: SellerRequestRow,
  serviceMap: Map<string, SellerServiceMatcher>
): AtlasSellerRequestRecord {
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
    status: request.status as AtlasSellerRequestRecord["status"],
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    fulfillment: parseSellerFulfillment(request.metadata)
  };
}

function buildSellerServiceMap(services: SellerServiceMatcher[]) {
  return new Map(services.map((service) => [service.key, service]));
}

async function listSellerServiceMatchers(organizationId: string, client: DatabaseClient) {
  return client.service.findMany({
    where: {
      organizationId
    },
    select: {
      id: true,
      key: true,
      name: true
    }
  });
}

async function listSellerRequestRows(organizationId: string, client: DatabaseClient) {
  return client.spendRequest.findMany({
    where: {
      sellerOrganizationId: organizationId
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

function createSellerAnalytics(requests: AtlasSellerRequestRecord[], services: SellerServiceMatcher[]): AtlasSellerAnalyticsRecord {
  const topServiceMap = new Map<
    string,
    {
      serviceId: string;
      serviceKey: string;
      serviceName: string;
      requestCount: number;
      completedRequestCount: number;
      failedRequestCount: number;
    }
  >();
  const topBuyerMap = new Map<
    string,
    {
      buyerOrganizationId: string;
      buyerOrganizationName: string;
      requestCount: number;
      completedRequestCount: number;
      failedRequestCount: number;
    }
  >();

  let pendingFulfillmentCount = 0;
  let completedRequestCount = 0;
  let failedRequestCount = 0;
  let unmatchedRequestCount = 0;

  for (const request of requests) {
    if (isAtlasSellerPendingFulfillmentStatus(request.status)) {
      pendingFulfillmentCount += 1;
    }

    if (request.status === "COMPLETED") {
      completedRequestCount += 1;
    }

    if (isAtlasSellerTerminalRequestStatus(request.status) && request.status !== "COMPLETED") {
      failedRequestCount += 1;
    }

    if (!request.matchedServiceId || !request.serviceKey) {
      unmatchedRequestCount += 1;
    } else {
      const currentService = topServiceMap.get(request.serviceKey) ?? {
        serviceId: request.matchedServiceId,
        serviceKey: request.serviceKey,
        serviceName: request.matchedServiceName ?? request.serviceKey,
        requestCount: 0,
        completedRequestCount: 0,
        failedRequestCount: 0
      };

      currentService.requestCount += 1;
      currentService.completedRequestCount += request.status === "COMPLETED" ? 1 : 0;
      currentService.failedRequestCount +=
        isAtlasSellerTerminalRequestStatus(request.status) && request.status !== "COMPLETED" ? 1 : 0;
      topServiceMap.set(request.serviceKey, currentService);
    }

    const currentBuyer = topBuyerMap.get(request.buyerOrganizationId) ?? {
      buyerOrganizationId: request.buyerOrganizationId,
      buyerOrganizationName: request.buyerOrganizationName,
      requestCount: 0,
      completedRequestCount: 0,
      failedRequestCount: 0
    };

    currentBuyer.requestCount += 1;
    currentBuyer.completedRequestCount += request.status === "COMPLETED" ? 1 : 0;
    currentBuyer.failedRequestCount +=
      isAtlasSellerTerminalRequestStatus(request.status) && request.status !== "COMPLETED" ? 1 : 0;
    topBuyerMap.set(request.buyerOrganizationId, currentBuyer);
  }

  const knownServiceKeys = new Set(services.map((service) => service.key));
  const topServices = [...topServiceMap.values()]
    .filter((service) => knownServiceKeys.has(service.serviceKey))
    .sort((left, right) => right.requestCount - left.requestCount || left.serviceName.localeCompare(right.serviceName))
    .slice(0, 5);
  const topBuyers = [...topBuyerMap.values()]
    .sort((left, right) => right.requestCount - left.requestCount || left.buyerOrganizationName.localeCompare(right.buyerOrganizationName))
    .slice(0, 5);

  return {
    pendingFulfillmentCount,
    completedRequestCount,
    failedRequestCount,
    unmatchedRequestCount,
    topServices,
    topBuyers
  };
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
  client: DatabaseClient = prisma
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
  client: DatabaseClient = prisma
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
  client: DatabaseClient = prisma
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
    assertSellerMutationActor(actor);
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
      }
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
    assertSellerMutationActor(actor);
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
      }
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
  client: DatabaseClient = prisma
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
  client: DatabaseClient = prisma
): Promise<AtlasSellerRequestRecord[]> {
  const [services, requests] = await Promise.all([
    listSellerServiceMatchers(organizationId, client),
    listSellerRequestRows(organizationId, client)
  ]);

  const serviceMap = buildSellerServiceMap(services);
  return requests.map((request) => mapSellerRequestRecord(request, serviceMap));
}

export async function getSellerRequest(
  organizationId: string,
  requestId: string,
  client: DatabaseClient = prisma
): Promise<AtlasSellerRequestRecord | null> {
  const [services, request] = await Promise.all([
    listSellerServiceMatchers(organizationId, client),
    client.spendRequest.findFirst({
      where: {
        id: requestId,
        sellerOrganizationId: organizationId
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  ]);

  if (!request) {
    return null;
  }

  return mapSellerRequestRecord(request, buildSellerServiceMap(services));
}

export async function getSellerAnalytics(
  organizationId: string,
  client: DatabaseClient = prisma
): Promise<AtlasSellerAnalyticsRecord> {
  const [services, requests] = await Promise.all([
    listSellerServiceMatchers(organizationId, client),
    listSellerRequests(organizationId, client)
  ]);

  return createSellerAnalytics(requests, services);
}

export async function recordSellerRequestFulfillment(
  actor: AtlasActorContext,
  requestId: string,
  rawInput: unknown
): Promise<AtlasSellerRequestRecord> {
  try {
    assertSellerMutationActor(actor);
    const input = atlasSellerRequestFulfillmentSchema.parse(rawInput);

    return await prisma.$transaction(async (transaction) => {
      const request = await transaction.spendRequest.findFirst({
        where: {
          id: requestId,
          sellerOrganizationId: actor.organization.id
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!request) {
        throw new AtlasSellerWorkflowError("The selected seller request is not available in this organization.", "not_found");
      }

      if (!isAtlasSellerRequestFulfillmentAllowed(request.status)) {
        throw new AtlasSellerWorkflowError(
          "Only approved or executing requests can be finalized by the seller.",
          "conflict"
        );
      }

      const matchedService =
        request.serviceKey
          ? await transaction.service.findFirst({
              where: {
                organizationId: actor.organization.id,
                key: request.serviceKey
              },
              select: {
                id: true,
                key: true,
                name: true
              }
            })
          : null;
      const currentMetadata = asJsonObject(request.metadata) ?? {};
      const recordedAt = new Date().toISOString();
      const nextStatus = input.fulfillmentStatus === "DELIVERED" ? "COMPLETED" : "FAILED";
      const nextMetadata = {
        ...currentMetadata,
        sellerFulfillment: {
          fulfillmentStatus: input.fulfillmentStatus,
          note: input.note,
          recordedAt,
          matchedServiceId: matchedService?.id ?? null,
          matchedServiceKey: matchedService?.key ?? request.serviceKey ?? null,
          recordedByUserId: actor.user.id,
          recordedByMembershipId: actor.membership.id
        }
      } satisfies Prisma.InputJsonValue;

      const updated = await transaction.spendRequest.update({
        where: {
          id: request.id
        },
        data: {
          status: nextStatus,
          metadata: nextMetadata
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      await createAuditEvent(transaction, actor, {
        requestId: updated.id,
        targetType: "SpendRequest",
        targetId: updated.id,
        eventType: input.fulfillmentStatus === "DELIVERED" ? "seller_delivery_confirmed" : "seller_delivery_failed",
        payload: {
          fulfillmentStatus: input.fulfillmentStatus,
          note: input.note,
          matchedServiceId: matchedService?.id ?? null,
          matchedServiceKey: matchedService?.key ?? request.serviceKey ?? null
        }
      });

      return mapSellerRequestRecord(
        updated,
        buildSellerServiceMap(matchedService ? [matchedService] : [])
      );
    });
  } catch (error) {
    normalizeValidationError(error);
  }
}
