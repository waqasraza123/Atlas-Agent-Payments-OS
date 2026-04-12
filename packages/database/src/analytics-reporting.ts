import {
  atlasBuyerPolicyRulesSchema,
  createAtlasCsv,
  deriveAtlasPaymentReconciliationState,
  formatAtlasTimelineLabel,
  isAtlasSellerPendingFulfillmentStatus,
  parseAtlasAnalyticsFilters,
  parseAtlasPolicyEvaluationResult,
  type AtlasActivityAnalyticsRecord,
  type AtlasAnalyticsBreakdownRecord,
  type AtlasAnalyticsFilters,
  type AtlasAnalyticsTimelinePoint,
  type AtlasBuyerAnalyticsRecord,
  type AtlasBuyerRequestAnalyticsRecord,
  type AtlasOrganizationHealthRecord,
  type AtlasPlatformAnalyticsRecord,
  type AtlasPlatformTransactionRecord,
  type AtlasSellerRevenueAnalyticsRecord,
  type AtlasSellerRequestAnalyticsRecord
} from "@atlas/domain";
import {
  canAtlasActorExportData,
  canAtlasActorInspectAnalytics,
  type AtlasActorContext
} from "@atlas/auth";
import type { OrganizationKind } from "@atlas/types";
import { ZodError } from "zod";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";

export class AtlasAnalyticsReportingError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "not_found" | "conflict" | "forbidden"
  ) {
    super(message);
    this.name = "AtlasAnalyticsReportingError";
  }
}

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type AtlasAnalyticsAccessMode = "inspect" | "export";

type RequestAnalyticsRow = Prisma.SpendRequestGetPayload<{
  include: {
    organization: {
      select: {
        id: true;
        name: true;
        kind: true;
      };
    };
    agent: {
      select: {
        id: true;
        name: true;
      };
    };
    sellerOrganization: {
      select: {
        id: true;
        name: true;
      };
    };
    approval: {
      select: {
        id: true;
        status: true;
        createdAt: true;
        updatedAt: true;
      };
    };
    payment: {
      include: {
        attempts: {
          orderBy: {
            attemptNumber: "desc";
          };
        };
      };
    };
    receipt: true;
  };
}>;

type BuyerPolicyBudgetRow = {
  rules: Prisma.JsonValue;
  status: string;
};

function normalizeValidationError(error: unknown): never {
  if (error instanceof AtlasAnalyticsReportingError) {
    throw error;
  }

  if (error instanceof ZodError) {
    throw new AtlasAnalyticsReportingError(error.issues.map((issue) => issue.message).join("; "), "bad_request");
  }

  throw error;
}

function assertTenantAnalyticsActor(
  actor: AtlasActorContext,
  input: {
    organizationId: string;
    workspace: OrganizationKind;
    accessMode: AtlasAnalyticsAccessMode;
  }
) {
  if (actor.workspace !== input.workspace || actor.organization.kind !== input.workspace) {
    throw new AtlasAnalyticsReportingError("Actor workspace does not match the requested tenant analytics scope.", "forbidden");
  }

  if (actor.organization.id !== input.organizationId) {
    throw new AtlasAnalyticsReportingError("Actor tenant scope does not match the requested analytics organization.", "forbidden");
  }

  if (input.accessMode === "inspect" && !canAtlasActorInspectAnalytics(actor)) {
    throw new AtlasAnalyticsReportingError("Support sessions cannot inspect analytics from this route.", "forbidden");
  }

  if (input.accessMode === "export" && !canAtlasActorExportData(actor)) {
    throw new AtlasAnalyticsReportingError("Support sessions cannot export tenant data.", "forbidden");
  }
}

function assertPlatformAnalyticsActor(actor: AtlasActorContext, accessMode: AtlasAnalyticsAccessMode) {
  if (actor.workspace !== "OPERATOR" || actor.organization.kind !== "OPERATOR") {
    throw new AtlasAnalyticsReportingError("Only operator actors can inspect platform analytics.", "forbidden");
  }

  if (accessMode === "inspect" && !canAtlasActorInspectAnalytics(actor)) {
    throw new AtlasAnalyticsReportingError("Support sessions cannot inspect platform analytics.", "forbidden");
  }

  if (accessMode === "export" && !canAtlasActorExportData(actor)) {
    throw new AtlasAnalyticsReportingError("Support sessions cannot export operator data.", "forbidden");
  }
}

function asJsonObject(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function extractSellerFulfillmentStatus(metadata: Prisma.JsonValue | null) {
  const metadataObject = asJsonObject(metadata);
  const sellerFulfillment =
    metadataObject?.sellerFulfillment &&
    typeof metadataObject.sellerFulfillment === "object" &&
    !Array.isArray(metadataObject.sellerFulfillment)
      ? (metadataObject.sellerFulfillment as Record<string, unknown>)
      : null;
  const fulfillmentStatus = sellerFulfillment?.fulfillmentStatus;

  return fulfillmentStatus === "DELIVERED" || fulfillmentStatus === "FAILED" ? fulfillmentStatus : null;
}

function extractProviderStatus(payment: RequestAnalyticsRow["payment"]) {
  const paymentMetadata = asJsonObject(payment?.metadata ?? null);
  const latestProviderStatus = paymentMetadata?.latestProviderStatus;

  if (typeof latestProviderStatus === "string" && latestProviderStatus.trim().length > 0) {
    return latestProviderStatus;
  }

  for (const attempt of payment?.attempts ?? []) {
    const evidence = asJsonObject(attempt.evidence);
    const providerStatus = evidence?.providerStatus;

    if (typeof providerStatus === "string" && providerStatus.trim().length > 0) {
      return providerStatus;
    }
  }

  return null;
}

function calculateShare(count: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return count / total;
}

function createBreakdownRecords(
  source: Map<string, { label: string; count: number; amountMinor: number }>,
  totalCount: number
) {
  return [...source.entries()]
    .map(([key, value]) => ({
      key,
      label: value.label,
      count: value.count,
      amountMinor: value.amountMinor,
      share: calculateShare(value.count, totalCount)
    }))
    .sort((left, right) => right.amountMinor - left.amountMinor || right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 6);
}

function createTimeline(points: Map<string, { date: Date; count: number; amountMinor: number }>): AtlasAnalyticsTimelinePoint[] {
  return [...points.values()]
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .map((item) => ({
      label: formatAtlasTimelineLabel(item.date),
      count: item.count,
      amountMinor: item.amountMinor
    }));
}

function buildAmountWhere(filters: AtlasAnalyticsFilters) {
  if (filters.minAmountMinor === undefined && filters.maxAmountMinor === undefined) {
    return undefined;
  }

  return {
    ...(filters.minAmountMinor !== undefined ? { gte: filters.minAmountMinor } : {}),
    ...(filters.maxAmountMinor !== undefined ? { lte: filters.maxAmountMinor } : {})
  } satisfies Prisma.IntFilter;
}

function buildDateWhere(filters: AtlasAnalyticsFilters) {
  if (!filters.startDate && !filters.endDate) {
    return undefined;
  }

  return {
    ...(filters.startDate ? { gte: new Date(`${filters.startDate}T00:00:00.000Z`) } : {}),
    ...(filters.endDate ? { lte: new Date(`${filters.endDate}T23:59:59.999Z`) } : {})
  } satisfies Prisma.DateTimeFilter;
}

function buildTextWhere(query: string | undefined, fields: Prisma.SpendRequestWhereInput[]) {
  if (!query) {
    return undefined;
  }

  return {
    OR: fields
  } satisfies Prisma.SpendRequestWhereInput;
}

function buildBuyerRequestWhere(organizationId: string, filters: AtlasAnalyticsFilters): Prisma.SpendRequestWhereInput {
  const where: Prisma.SpendRequestWhereInput = {
    organizationId,
    ...(filters.requestStatus ? { status: filters.requestStatus } : {}),
    ...(filters.serviceCategory
      ? {
          serviceCategory: {
            contains: filters.serviceCategory,
            mode: "insensitive"
          }
        }
      : {}),
    ...(buildAmountWhere(filters) ? { amountMinor: buildAmountWhere(filters) } : {}),
    ...(buildDateWhere(filters) ? { createdAt: buildDateWhere(filters) } : {}),
    ...(filters.paymentStatus || filters.paymentRail
      ? {
          payment: {
            is: {
              ...(filters.paymentStatus ? { status: filters.paymentStatus } : {}),
              ...(filters.paymentRail ? { rail: filters.paymentRail } : {})
            }
          }
        }
      : {}),
    ...(filters.receiptStatus
      ? {
          receipt: {
            is: {
              status: filters.receiptStatus
            }
          }
        }
      : {})
  };

  const textWhere = buildTextWhere(filters.query, [
    {
      title: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      purpose: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      serviceCategory: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      serviceKey: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      agent: {
        is: {
          name: {
            contains: filters.query,
            mode: "insensitive"
          }
        }
      }
    },
    {
      sellerOrganization: {
        is: {
          name: {
            contains: filters.query,
            mode: "insensitive"
          }
        }
      }
    }
  ]);

  return textWhere ? { AND: [where, textWhere] } : where;
}

function buildSellerRequestWhere(organizationId: string, filters: AtlasAnalyticsFilters): Prisma.SpendRequestWhereInput {
  const where: Prisma.SpendRequestWhereInput = {
    sellerOrganizationId: organizationId,
    ...(filters.requestStatus ? { status: filters.requestStatus } : {}),
    ...(filters.serviceCategory
      ? {
          serviceCategory: {
            contains: filters.serviceCategory,
            mode: "insensitive"
          }
        }
      : {}),
    ...(buildAmountWhere(filters) ? { amountMinor: buildAmountWhere(filters) } : {}),
    ...(buildDateWhere(filters) ? { createdAt: buildDateWhere(filters) } : {}),
    ...(filters.paymentStatus || filters.paymentRail
      ? {
          payment: {
            is: {
              ...(filters.paymentStatus ? { status: filters.paymentStatus } : {}),
              ...(filters.paymentRail ? { rail: filters.paymentRail } : {})
            }
          }
        }
      : {}),
    ...(filters.receiptStatus
      ? {
          receipt: {
            is: {
              status: filters.receiptStatus
            }
          }
        }
      : {})
  };

  const textWhere = buildTextWhere(filters.query, [
    {
      title: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      purpose: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      serviceCategory: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      serviceKey: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      organization: {
        is: {
          name: {
            contains: filters.query,
            mode: "insensitive"
          }
        }
      }
    }
  ]);

  return textWhere ? { AND: [where, textWhere] } : where;
}

function buildPlatformRequestWhere(filters: AtlasAnalyticsFilters): Prisma.SpendRequestWhereInput {
  const where: Prisma.SpendRequestWhereInput = {
    ...(filters.requestStatus ? { status: filters.requestStatus } : {}),
    ...(filters.serviceCategory
      ? {
          serviceCategory: {
            contains: filters.serviceCategory,
            mode: "insensitive"
          }
        }
      : {}),
    ...(buildAmountWhere(filters) ? { amountMinor: buildAmountWhere(filters) } : {}),
    ...(buildDateWhere(filters) ? { createdAt: buildDateWhere(filters) } : {}),
    ...(filters.paymentStatus || filters.paymentRail
      ? {
          payment: {
            is: {
              ...(filters.paymentStatus ? { status: filters.paymentStatus } : {}),
              ...(filters.paymentRail ? { rail: filters.paymentRail } : {})
            }
          }
        }
      : {}),
    ...(filters.receiptStatus
      ? {
          receipt: {
            is: {
              status: filters.receiptStatus
            }
          }
        }
      : {})
  };

  const textWhere = buildTextWhere(filters.query, [
    {
      title: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      purpose: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      serviceCategory: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      serviceKey: {
        contains: filters.query,
        mode: "insensitive"
      }
    },
    {
      organization: {
        is: {
          name: {
            contains: filters.query,
            mode: "insensitive"
          }
        }
      }
    },
    {
      sellerOrganization: {
        is: {
          name: {
            contains: filters.query,
            mode: "insensitive"
          }
        }
      }
    }
  ]);

  return textWhere ? { AND: [where, textWhere] } : where;
}

function mapBuyerRequestRecord(row: RequestAnalyticsRow): AtlasBuyerRequestAnalyticsRecord {
  const evaluation = parseAtlasPolicyEvaluationResult(row.evaluationResult);
  const paymentStatus = row.payment?.status ?? null;
  const receiptStatus = row.receipt?.status ?? null;
  const sellerFulfillmentStatus = extractSellerFulfillmentStatus(row.metadata);

  return {
    id: row.id,
    title: row.title,
    purpose: row.purpose,
    agentName: row.agent.name,
    sellerOrganizationName: row.sellerOrganization?.name ?? null,
    amountMinor: row.amountMinor,
    currency: row.currency,
    serviceCategory: row.serviceCategory,
    serviceKey: row.serviceKey,
    requestStatus: row.status,
    approvalStatus: row.approval?.status ?? null,
    paymentStatus,
    receiptStatus,
    paymentRail: row.payment?.rail ?? null,
    evaluationOutcome: evaluation?.outcome ?? null,
    reconciliationState: deriveAtlasPaymentReconciliationState({
      requestStatus: row.status,
      paymentStatus,
      receiptStatus,
      sellerFulfillmentStatus
    }),
    createdAt: row.createdAt.toISOString()
  };
}

function mapSellerRequestRecord(row: RequestAnalyticsRow): AtlasSellerRequestAnalyticsRecord {
  const paymentStatus = row.payment?.status ?? null;
  const receiptStatus = row.receipt?.status ?? null;
  const fulfillmentStatus = extractSellerFulfillmentStatus(row.metadata);

  return {
    id: row.id,
    title: row.title,
    buyerOrganizationName: row.organization.name,
    amountMinor: row.amountMinor,
    currency: row.currency,
    serviceCategory: row.serviceCategory,
    serviceKey: row.serviceKey,
    matchedServiceName: row.serviceKey,
    requestStatus: row.status,
    paymentStatus,
    receiptStatus,
    fulfillmentStatus,
    reconciliationState: deriveAtlasPaymentReconciliationState({
      requestStatus: row.status,
      paymentStatus,
      receiptStatus,
      sellerFulfillmentStatus: fulfillmentStatus
    }),
    createdAt: row.createdAt.toISOString()
  };
}

function mapPlatformTransaction(row: RequestAnalyticsRow): AtlasPlatformTransactionRecord {
  const paymentStatus = row.payment?.status ?? null;
  const receiptStatus = row.receipt?.status ?? null;
  const sellerFulfillmentStatus = extractSellerFulfillmentStatus(row.metadata);

  return {
    id: row.id,
    requestTitle: row.title,
    buyerOrganizationName: row.organization.name,
    sellerOrganizationName: row.sellerOrganization?.name ?? null,
    amountMinor: row.amountMinor,
    currency: row.currency,
    requestStatus: row.status,
    paymentStatus,
    receiptStatus,
    paymentRail: row.payment?.rail ?? null,
    providerStatus: extractProviderStatus(row.payment),
    reconciliationState: deriveAtlasPaymentReconciliationState({
      requestStatus: row.status,
      paymentStatus,
      receiptStatus,
      sellerFulfillmentStatus
    }),
    attemptCount: row.payment?.attempts.length ?? 0,
    createdAt: row.createdAt.toISOString()
  };
}

function filterByRiskLevel<T extends { reconciliationState: string; requestStatus?: string | null }>(
  items: T[],
  riskLevel: AtlasAnalyticsFilters["riskLevel"]
) {
  if (!riskLevel) {
    return items;
  }

  return items.filter((item) =>
    riskLevel === "attention"
      ? item.reconciliationState !== "RECEIPT_AVAILABLE"
      : item.reconciliationState === "RECEIPT_AVAILABLE"
  );
}

async function loadRequestRows(where: Prisma.SpendRequestWhereInput, client: DatabaseClient = prisma) {
  return client.spendRequest.findMany({
    where,
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          kind: true
        }
      },
      agent: {
        select: {
          id: true,
          name: true
        }
      },
      sellerOrganization: {
        select: {
          id: true,
          name: true
        }
      },
      approval: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      },
      payment: {
        include: {
          attempts: {
            orderBy: {
              attemptNumber: "desc"
            }
          }
        }
      },
      receipt: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

function createSpendTimeline(rows: RequestAnalyticsRow[], selectAmount: (row: RequestAnalyticsRow) => number) {
  const timeline = new Map<string, { date: Date; count: number; amountMinor: number }>();

  for (const row of rows) {
    const date = new Date(row.createdAt);
    const key = date.toISOString().slice(0, 10);
    const currentValue = timeline.get(key) ?? {
      date,
      count: 0,
      amountMinor: 0
    };

    currentValue.count += 1;
    currentValue.amountMinor += selectAmount(row);
    timeline.set(key, currentValue);
  }

  return createTimeline(timeline);
}

function createStatusMix(rows: RequestAnalyticsRow[]) {
  const values = new Map<string, { label: string; count: number; amountMinor: number }>();

  for (const row of rows) {
    const currentValue = values.get(row.status) ?? {
      label: row.status,
      count: 0,
      amountMinor: 0
    };

    currentValue.count += 1;
    currentValue.amountMinor += row.amountMinor;
    values.set(row.status, currentValue);
  }

  return createBreakdownRecords(values, rows.length);
}

export async function getBuyerAnalytics(organizationId: string, client: DatabaseClient = prisma): Promise<AtlasBuyerAnalyticsRecord> {
  const [rows, policies] = await Promise.all([
    loadRequestRows(
      {
        organizationId
      },
      client
    ),
    client.policy.findMany({
      where: {
        organizationId,
        status: "ACTIVE"
      },
      select: {
        rules: true,
        status: true
      }
    })
  ]);

  const topAgents = new Map<string, { label: string; count: number; amountMinor: number }>();
  const topSellers = new Map<string, { label: string; count: number; amountMinor: number }>();
  const topServices = new Map<string, { label: string; count: number; amountMinor: number }>();

  let totalSpendMinor = 0;
  let completedRequestCount = 0;
  let pendingApprovalCount = 0;
  let autoApprovedCount = 0;
  let manualApprovedCount = 0;
  let exceptionCount = 0;
  let approvalTurnaroundHoursTotal = 0;
  let approvalTurnaroundCount = 0;

  for (const row of rows) {
    const evaluation = parseAtlasPolicyEvaluationResult(row.evaluationResult);
    const paymentStatus = row.payment?.status ?? null;
    const receiptStatus = row.receipt?.status ?? null;
    const reconciliationState = deriveAtlasPaymentReconciliationState({
      requestStatus: row.status,
      paymentStatus,
      receiptStatus,
      sellerFulfillmentStatus: extractSellerFulfillmentStatus(row.metadata)
    });

    if (paymentStatus === "AUTHORIZED" || paymentStatus === "CAPTURED" || row.status === "COMPLETED") {
      totalSpendMinor += row.amountMinor;
    }

    if (row.status === "COMPLETED") {
      completedRequestCount += 1;
    }

    if (row.approval?.status === "PENDING") {
      pendingApprovalCount += 1;
    }

    if (evaluation?.outcome === "allow_auto_approved") {
      autoApprovedCount += 1;
    }

    if (row.approval?.status === "APPROVED") {
      manualApprovedCount += 1;
      approvalTurnaroundHoursTotal += (row.approval.updatedAt.getTime() - row.approval.createdAt.getTime()) / 3_600_000;
      approvalTurnaroundCount += 1;
    }

    if (reconciliationState !== "RECEIPT_AVAILABLE" || row.status === "FAILED" || row.status === "REJECTED") {
      exceptionCount += 1;
    }

    const agentBucket = topAgents.get(row.agent.id) ?? {
      label: row.agent.name,
      count: 0,
      amountMinor: 0
    };
    agentBucket.count += 1;
    agentBucket.amountMinor += row.amountMinor;
    topAgents.set(row.agent.id, agentBucket);

    if (row.sellerOrganization) {
      const sellerBucket = topSellers.get(row.sellerOrganization.id) ?? {
        label: row.sellerOrganization.name,
        count: 0,
        amountMinor: 0
      };
      sellerBucket.count += 1;
      sellerBucket.amountMinor += row.amountMinor;
      topSellers.set(row.sellerOrganization.id, sellerBucket);
    }

    const serviceKey = row.serviceKey ?? row.serviceCategory;
    const serviceBucket = topServices.get(serviceKey) ?? {
      label: serviceKey,
      count: 0,
      amountMinor: 0
    };
    serviceBucket.count += 1;
    serviceBucket.amountMinor += row.amountMinor;
    topServices.set(serviceKey, serviceBucket);
  }

  const policyBudgetMinor = policies.reduce((sum, policy) => {
    try {
      const rules = atlasBuyerPolicyRulesSchema.parse(policy.rules);
      return sum + (rules.maxAmountMinor ?? 0);
    } catch {
      return sum;
    }
  }, 0);

  return {
    totalSpendMinor,
    requestCount: rows.length,
    completedRequestCount,
    pendingApprovalCount,
    autoApprovedCount,
    manualApprovedCount,
    exceptionRate: rows.length > 0 ? exceptionCount / rows.length : 0,
    budgetUtilizationRate: policyBudgetMinor > 0 ? totalSpendMinor / policyBudgetMinor : 0,
    averageApprovalTurnaroundHours: approvalTurnaroundCount > 0 ? approvalTurnaroundHoursTotal / approvalTurnaroundCount : null,
    spendTimeline: createSpendTimeline(rows, (row) => row.amountMinor),
    topAgents: createBreakdownRecords(topAgents, rows.length),
    topSellers: createBreakdownRecords(topSellers, rows.length),
    topServices: createBreakdownRecords(topServices, rows.length),
    statusMix: createStatusMix(rows)
  };
}

export async function getBuyerAnalyticsForActor(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  assertTenantAnalyticsActor(actor, {
    organizationId: actor.organization.id,
    workspace: "BUYER",
    accessMode: "inspect"
  });

  return getBuyerAnalytics(actor.organization.id, client);
}

export async function listBuyerRequestAnalytics(
  organizationId: string,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  try {
    const filters = parseAtlasAnalyticsFilters(rawFilters);
    const rows = await loadRequestRows(buildBuyerRequestWhere(organizationId, filters), client);
    const records = rows.map(mapBuyerRequestRecord);
    return filterByRiskLevel(records, filters.riskLevel);
  } catch (error) {
    normalizeValidationError(error);
  }
}

export async function listBuyerRequestAnalyticsForActor(
  actor: AtlasActorContext,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  assertTenantAnalyticsActor(actor, {
    organizationId: actor.organization.id,
    workspace: "BUYER",
    accessMode: "inspect"
  });

  return listBuyerRequestAnalytics(actor.organization.id, rawFilters, client);
}

export async function listBuyerActivityAnalytics(
  organizationId: string,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  try {
    const filters = parseAtlasAnalyticsFilters(rawFilters);
    const auditEvents = await client.auditEvent.findMany({
      where: {
        organizationId,
        ...(filters.eventType ? { eventType: filters.eventType } : {}),
        ...(filters.targetType ? { targetType: filters.targetType } : {}),
        ...(buildDateWhere(filters) ? { occurredAt: buildDateWhere(filters) } : {})
      },
      include: {
        user: true,
        request: {
          select: {
            title: true
          }
        }
      },
      orderBy: {
        occurredAt: "desc"
      }
    });

    return auditEvents
      .map(
        (event): AtlasActivityAnalyticsRecord => ({
          id: event.id,
          eventType: event.eventType,
          targetType: event.targetType,
          targetId: event.targetId,
          actorType: event.actorType,
          actorLabel: event.user?.name ?? event.user?.email ?? event.actorType.toLowerCase(),
          requestTitle: event.request?.title ?? null,
          occurredAt: event.occurredAt.toISOString()
        })
      )
      .filter((event) =>
        filters.query
          ? [event.eventType, event.targetType, event.targetId, event.actorLabel, event.requestTitle]
              .filter((value): value is string => Boolean(value))
              .some((value) => value.toLowerCase().includes(filters.query!.toLowerCase()))
          : true
      );
  } catch (error) {
    normalizeValidationError(error);
  }
}

export async function listBuyerActivityAnalyticsForActor(
  actor: AtlasActorContext,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  assertTenantAnalyticsActor(actor, {
    organizationId: actor.organization.id,
    workspace: "BUYER",
    accessMode: "inspect"
  });

  return listBuyerActivityAnalytics(actor.organization.id, rawFilters, client);
}

export async function exportBuyerRequestCsv(
  organizationId: string,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  const rows = await listBuyerRequestAnalytics(organizationId, rawFilters, client);

  return createAtlasCsv(
    [
      { key: "id", label: "Request ID" },
      { key: "title", label: "Title" },
      { key: "agentName", label: "Agent" },
      { key: "sellerOrganizationName", label: "Seller" },
      { key: "amountMinor", label: "Amount Minor" },
      { key: "currency", label: "Currency" },
      { key: "serviceCategory", label: "Service Category" },
      { key: "requestStatus", label: "Request Status" },
      { key: "paymentStatus", label: "Payment Status" },
      { key: "receiptStatus", label: "Receipt Status" },
      { key: "reconciliationState", label: "Reconciliation State" },
      { key: "createdAt", label: "Created At" }
    ],
    rows.map((row) => ({
      ...row,
      sellerOrganizationName: row.sellerOrganizationName ?? ""
    }))
  );
}

export async function exportBuyerRequestCsvForActor(
  actor: AtlasActorContext,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  assertTenantAnalyticsActor(actor, {
    organizationId: actor.organization.id,
    workspace: "BUYER",
    accessMode: "export"
  });

  return exportBuyerRequestCsv(actor.organization.id, rawFilters, client);
}

export async function getSellerRevenueAnalytics(
  organizationId: string,
  client: DatabaseClient = prisma
): Promise<AtlasSellerRevenueAnalyticsRecord> {
  const rows = await loadRequestRows(
    {
      sellerOrganizationId: organizationId
    },
    client
  );

  const topServices = new Map<string, { label: string; count: number; amountMinor: number }>();
  const topBuyers = new Map<string, { label: string; count: number; amountMinor: number }>();
  const repeatBuyerCounter = new Map<string, number>();

  let totalRevenueMinor = 0;
  let completedRequestCount = 0;
  let pendingFulfillmentCount = 0;

  for (const row of rows) {
    if (row.status === "COMPLETED") {
      totalRevenueMinor += row.amountMinor;
      completedRequestCount += 1;
    }

    if (isAtlasSellerPendingFulfillmentStatus(row.status)) {
      pendingFulfillmentCount += 1;
    }

    const serviceKey = row.serviceKey ?? row.serviceCategory;
    const serviceBucket = topServices.get(serviceKey) ?? {
      label: serviceKey,
      count: 0,
      amountMinor: 0
    };
    serviceBucket.count += 1;
    serviceBucket.amountMinor += row.amountMinor;
    topServices.set(serviceKey, serviceBucket);

    const buyerBucket = topBuyers.get(row.organization.id) ?? {
      label: row.organization.name,
      count: 0,
      amountMinor: 0
    };
    buyerBucket.count += 1;
    buyerBucket.amountMinor += row.amountMinor;
    topBuyers.set(row.organization.id, buyerBucket);
    repeatBuyerCounter.set(row.organization.id, (repeatBuyerCounter.get(row.organization.id) ?? 0) + 1);
  }

  return {
    totalRevenueMinor,
    requestCount: rows.length,
    completedRequestCount,
    pendingFulfillmentCount,
    repeatBuyerCount: [...repeatBuyerCounter.values()].filter((count) => count > 1).length,
    revenueTimeline: createSpendTimeline(rows.filter((row) => row.status === "COMPLETED"), (row) => row.amountMinor),
    topServices: createBreakdownRecords(topServices, rows.length),
    topBuyers: createBreakdownRecords(topBuyers, rows.length),
    statusMix: createStatusMix(rows)
  };
}

export async function getSellerRevenueAnalyticsForActor(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  assertTenantAnalyticsActor(actor, {
    organizationId: actor.organization.id,
    workspace: "SELLER",
    accessMode: "inspect"
  });

  return getSellerRevenueAnalytics(actor.organization.id, client);
}

export async function listSellerRequestAnalytics(
  organizationId: string,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  try {
    const filters = parseAtlasAnalyticsFilters(rawFilters);
    const rows = await loadRequestRows(buildSellerRequestWhere(organizationId, filters), client);
    const records = rows.map(mapSellerRequestRecord);
    return filterByRiskLevel(records, filters.riskLevel);
  } catch (error) {
    normalizeValidationError(error);
  }
}

export async function listSellerRequestAnalyticsForActor(
  actor: AtlasActorContext,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  assertTenantAnalyticsActor(actor, {
    organizationId: actor.organization.id,
    workspace: "SELLER",
    accessMode: "inspect"
  });

  return listSellerRequestAnalytics(actor.organization.id, rawFilters, client);
}

export async function exportSellerRequestCsv(
  organizationId: string,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  const rows = await listSellerRequestAnalytics(organizationId, rawFilters, client);

  return createAtlasCsv(
    [
      { key: "id", label: "Request ID" },
      { key: "title", label: "Title" },
      { key: "buyerOrganizationName", label: "Buyer Organization" },
      { key: "amountMinor", label: "Amount Minor" },
      { key: "currency", label: "Currency" },
      { key: "serviceCategory", label: "Service Category" },
      { key: "requestStatus", label: "Request Status" },
      { key: "paymentStatus", label: "Payment Status" },
      { key: "receiptStatus", label: "Receipt Status" },
      { key: "fulfillmentStatus", label: "Fulfillment Status" },
      { key: "reconciliationState", label: "Reconciliation State" },
      { key: "createdAt", label: "Created At" }
    ],
    rows.map((row) => ({
      ...row,
      fulfillmentStatus: row.fulfillmentStatus ?? ""
    }))
  );
}

export async function exportSellerRequestCsvForActor(
  actor: AtlasActorContext,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  assertTenantAnalyticsActor(actor, {
    organizationId: actor.organization.id,
    workspace: "SELLER",
    accessMode: "export"
  });

  return exportSellerRequestCsv(actor.organization.id, rawFilters, client);
}

export async function getPlatformAnalytics(client: DatabaseClient = prisma): Promise<AtlasPlatformAnalyticsRecord> {
  const [requests, payments, approvals, organizations, activeAgents, openCases] = await Promise.all([
    loadRequestRows({}, client),
    client.payment.findMany({
      select: {
        rail: true,
        status: true,
        amountMinor: true
      }
    }),
    client.approval.count(),
    client.organization.count(),
    client.agent.count({
      where: {
        requests: {
          some: {}
        }
      }
    }),
    client.operatorCase.count({
      where: {
        status: {
          in: ["OPEN", "INVESTIGATING", "ACTION_REQUIRED"]
        }
      }
    })
  ]);

  const railMix = new Map<string, { label: string; count: number; amountMinor: number }>();
  const categoryMix = new Map<string, { label: string; count: number; amountMinor: number }>();
  let successfulPaymentCount = 0;
  let totalCompletionHours = 0;
  let completionCount = 0;

  for (const payment of payments) {
    const currentRail = railMix.get(payment.rail) ?? {
      label: payment.rail,
      count: 0,
      amountMinor: 0
    };

    currentRail.count += 1;
    currentRail.amountMinor += payment.amountMinor;
    railMix.set(payment.rail, currentRail);

    if (payment.status === "CAPTURED") {
      successfulPaymentCount += 1;
    }
  }

  for (const request of requests) {
    const currentCategory = categoryMix.get(request.serviceCategory) ?? {
      label: request.serviceCategory,
      count: 0,
      amountMinor: 0
    };

    currentCategory.count += 1;
    currentCategory.amountMinor += request.amountMinor;
    categoryMix.set(request.serviceCategory, currentCategory);

    if (["COMPLETED", "FAILED", "REJECTED", "CANCELED"].includes(request.status)) {
      totalCompletionHours += (request.updatedAt.getTime() - request.createdAt.getTime()) / 3_600_000;
      completionCount += 1;
    }
  }

  return {
    activeOrganizationCount: organizations,
    activeAgentCount: activeAgents,
    totalRequestCount: requests.length,
    totalApprovalCount: approvals,
    successfulPaymentCount,
    openExceptionCount: openCases,
    averageRequestCompletionHours: completionCount > 0 ? totalCompletionHours / completionCount : null,
    requestTimeline: createSpendTimeline(requests, (row) => row.amountMinor),
    railMix: createBreakdownRecords(railMix, payments.length),
    categoryMix: createBreakdownRecords(categoryMix, requests.length)
  };
}

export async function getPlatformAnalyticsForActor(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  assertPlatformAnalyticsActor(actor, "inspect");
  return getPlatformAnalytics(client);
}

export async function listPlatformTransactions(
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  try {
    const filters = parseAtlasAnalyticsFilters(rawFilters);
    const rows = await loadRequestRows(buildPlatformRequestWhere(filters), client);
    const records = rows.map(mapPlatformTransaction);
    return filterByRiskLevel(records, filters.riskLevel);
  } catch (error) {
    normalizeValidationError(error);
  }
}

export async function listPlatformTransactionsForActor(
  actor: AtlasActorContext,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  assertPlatformAnalyticsActor(actor, "inspect");
  return listPlatformTransactions(rawFilters, client);
}

export async function listPlatformOrganizations(client: DatabaseClient = prisma): Promise<AtlasOrganizationHealthRecord[]> {
  const [organizations, requestCounts, paymentCounts, receiptCounts, openCases, latestAuditEvents] = await Promise.all([
    client.organization.findMany({
      orderBy: {
        name: "asc"
      }
    }),
    client.spendRequest.groupBy({
      by: ["organizationId"],
      _count: {
        _all: true
      }
    }),
    client.payment.groupBy({
      by: ["organizationId"],
      _count: {
        _all: true
      }
    }),
    client.receipt.groupBy({
      by: ["organizationId", "status"],
      _count: {
        _all: true
      }
    }),
    client.operatorCase.groupBy({
      by: ["organizationId"],
      where: {
        status: {
          in: ["OPEN", "INVESTIGATING", "ACTION_REQUIRED"]
        }
      },
      _count: {
        _all: true
      }
    }),
    client.auditEvent.findMany({
      where: {
        organizationId: {
          not: null
        }
      },
      orderBy: {
        occurredAt: "desc"
      },
      select: {
        organizationId: true,
        occurredAt: true
      }
    })
  ]);

  const requestCountMap = new Map(requestCounts.map((item) => [item.organizationId, item._count._all]));
  const paymentCountMap = new Map(paymentCounts.map((item) => [item.organizationId, item._count._all]));
  const receiptCountMap = new Map(
    receiptCounts
      .filter((item) => item.status === "AVAILABLE")
      .map((item) => [item.organizationId, item._count._all])
  );
  const openCaseMap = new Map(openCases.map((item) => [item.organizationId, item._count._all]));
  const latestActivityMap = new Map<string, string>();

  for (const item of latestAuditEvents) {
    if (!item.organizationId || latestActivityMap.has(item.organizationId)) {
      continue;
    }

    latestActivityMap.set(item.organizationId, item.occurredAt.toISOString());
  }

  return organizations.map((organization) => ({
    organizationId: organization.id,
    organizationName: organization.name,
    organizationKind: organization.kind,
    requestCount: requestCountMap.get(organization.id) ?? 0,
    paymentCount: paymentCountMap.get(organization.id) ?? 0,
    receiptAvailableCount: receiptCountMap.get(organization.id) ?? 0,
    openCaseCount: openCaseMap.get(organization.id) ?? 0,
    lastActivityAt: latestActivityMap.get(organization.id) ?? null
  }));
}

export async function listPlatformOrganizationsForActor(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  assertPlatformAnalyticsActor(actor, "inspect");
  return listPlatformOrganizations(client);
}

export async function exportPlatformTransactionCsv(
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  const rows = await listPlatformTransactions(rawFilters, client);

  return createAtlasCsv(
    [
      { key: "id", label: "Request ID" },
      { key: "requestTitle", label: "Request Title" },
      { key: "buyerOrganizationName", label: "Buyer Organization" },
      { key: "sellerOrganizationName", label: "Seller Organization" },
      { key: "amountMinor", label: "Amount Minor" },
      { key: "currency", label: "Currency" },
      { key: "requestStatus", label: "Request Status" },
      { key: "paymentStatus", label: "Payment Status" },
      { key: "receiptStatus", label: "Receipt Status" },
      { key: "paymentRail", label: "Payment Rail" },
      { key: "reconciliationState", label: "Reconciliation State" },
      { key: "attemptCount", label: "Attempt Count" },
      { key: "createdAt", label: "Created At" }
    ],
    rows.map((row) => ({
      ...row,
      sellerOrganizationName: row.sellerOrganizationName ?? "",
      paymentStatus: row.paymentStatus ?? "",
      receiptStatus: row.receiptStatus ?? "",
      paymentRail: row.paymentRail ?? ""
    }))
  );
}

export async function exportPlatformTransactionCsvForActor(
  actor: AtlasActorContext,
  rawFilters: Record<string, string | string[] | undefined> = {},
  client: DatabaseClient = prisma
) {
  assertPlatformAnalyticsActor(actor, "export");
  return exportPlatformTransactionCsv(rawFilters, client);
}
