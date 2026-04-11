import type { AtlasActorContext } from "@atlas/auth";
import {
  atlasOperatorAuditFiltersSchema,
  atlasOperatorCaseActionSchema,
  atlasOperatorCaseFiltersSchema,
  buildAtlasOperatorCaseKey,
  classifyAtlasOperatorException,
  deriveAtlasOperatorAvailableActions,
  deriveAtlasOperatorReconciliationState,
  matchesAtlasOperatorTextFilter,
  type AtlasOperatorActionRecord,
  type AtlasOperatorAuditEventRecord,
  type AtlasOperatorCaseRecord,
  type AtlasOperatorNotificationRecord,
  type AtlasOperatorOverviewRecord
} from "@atlas/domain";
import { isAtlasPaymentRetryEligible } from "@atlas/domain";
import { ZodError } from "zod";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";
import { executeOperatorPayment } from "./payments-workflow";

export class AtlasOperatorWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "not_found" | "conflict" | "forbidden"
  ) {
    super(message);
    this.name = "AtlasOperatorWorkflowError";
  }
}

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type AtlasOperatorCaseDetailRecord = {
  item: AtlasOperatorCaseRecord;
  actions: AtlasOperatorActionRecord[];
  notifications: AtlasOperatorNotificationRecord[];
  auditEvents: AtlasOperatorAuditEventRecord[];
};

type OperatorCaseQueryRow = Prisma.OperatorCaseGetPayload<{
  include: {
    request: {
      include: {
        organization: true;
        sellerOrganization: true;
        payment: {
          include: {
            attempts: true;
          };
        };
        receipt: true;
      };
    };
    actions: {
      include: {
        actorUser: true;
      };
      orderBy: {
        createdAt: "desc";
      };
    };
    notifications: {
      orderBy: {
        createdAt: "desc";
      };
    };
  };
}>;

type AuditEventRow = Prisma.AuditEventGetPayload<{
  include: {
    organization: true;
    user: true;
    request: {
      include: {
        organization: true;
      };
    };
  };
}>;

function normalizeValidationError(error: unknown): never {
  if (error instanceof AtlasOperatorWorkflowError) {
    throw error;
  }

  if (error instanceof ZodError) {
    throw new AtlasOperatorWorkflowError(error.issues.map((issue) => issue.message).join("; "), "bad_request");
  }

  throw error;
}

function asJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asInputJsonValue(value: Record<string, unknown>) {
  return value as Prisma.InputJsonValue;
}

function extractOperatorControls(metadata: Prisma.JsonValue | null) {
  const metadataObject = asJsonObject(metadata);
  const operatorControls =
    metadataObject?.operatorControls &&
    typeof metadataObject.operatorControls === "object" &&
    !Array.isArray(metadataObject.operatorControls)
      ? (metadataObject.operatorControls as Record<string, unknown>)
      : null;

  if (!operatorControls) {
    return {
      paused: false,
      pauseReason: null as string | null,
      pausedAt: null as string | null,
      releasedAt: null as string | null
    };
  }

  const pauseReason = typeof operatorControls.pauseReason === "string" ? operatorControls.pauseReason : null;
  const pausedAt = typeof operatorControls.pausedAt === "string" ? operatorControls.pausedAt : null;
  const releasedAt = typeof operatorControls.releasedAt === "string" ? operatorControls.releasedAt : null;

  return {
    paused: operatorControls.paused === true,
    pauseReason,
    pausedAt,
    releasedAt
  };
}

function createOperatorControlsMetadata(
  existingMetadata: Prisma.JsonValue | null,
  input: {
    paused: boolean;
    reason: string;
    actorUserId: string;
  }
) {
  const existingObject = asJsonObject(existingMetadata) ?? {};
  const currentControls = extractOperatorControls(existingMetadata);
  const timestamp = new Date().toISOString();

  return {
    ...existingObject,
    operatorControls: {
      paused: input.paused,
      pauseReason: input.reason,
      pausedByUserId: input.paused ? input.actorUserId : currentControls.paused ? input.actorUserId : null,
      pausedAt: input.paused ? timestamp : currentControls.pausedAt,
      releasedByUserId: input.paused ? null : input.actorUserId,
      releasedAt: input.paused ? currentControls.releasedAt : timestamp
    }
  } satisfies Prisma.InputJsonObject;
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

function extractCaseMetadata(value: Prisma.JsonValue | null) {
  return asJsonObject(value);
}

function createOperatorStateFingerprint(input: {
  requestStatus: string;
  paymentStatus: string | null;
  receiptStatus: string | null;
  sellerFulfillmentStatus: string | null;
  paused: boolean;
  paymentAttemptCount: number;
}) {
  return [
    input.requestStatus,
    input.paymentStatus ?? "no-payment",
    input.receiptStatus ?? "no-receipt",
    input.sellerFulfillmentStatus ?? "no-fulfillment",
    input.paused ? "paused" : "active",
    String(input.paymentAttemptCount)
  ].join(":");
}

function extractProviderStatusFromPayment(payment: {
  metadata: Prisma.JsonValue | null;
  attempts: Array<{ evidence: Prisma.JsonValue | null }>;
} | null) {
  const paymentMetadata = asJsonObject(payment?.metadata ?? null);
  const latestProviderStatus = paymentMetadata?.latestProviderStatus;

  if (typeof latestProviderStatus === "string" && latestProviderStatus.trim().length > 0) {
    return latestProviderStatus;
  }

  for (const attempt of payment?.attempts ?? []) {
    const evidenceObject = asJsonObject(attempt.evidence);
    const providerStatus = evidenceObject?.providerStatus;

    if (typeof providerStatus === "string" && providerStatus.trim().length > 0) {
      return providerStatus;
    }
  }

  return null;
}

function mapOperatorActionRecord(action: OperatorCaseQueryRow["actions"][number]): AtlasOperatorActionRecord {
  return {
    id: action.id,
    caseId: action.caseId,
    actionType: action.actionType,
    reason: action.reason,
    actorUserId: action.actorUserId,
    actorUserName: action.actorUser.name,
    actorUserEmail: action.actorUser.email,
    createdAt: action.createdAt.toISOString()
  };
}

function mapOperatorNotificationRecord(notification: OperatorCaseQueryRow["notifications"][number]): AtlasOperatorNotificationRecord {
  return {
    id: notification.id,
    dedupeKey: notification.dedupeKey,
    caseId: notification.caseId,
    category: notification.category,
    title: notification.title,
    description: notification.description,
    status: notification.status,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString()
  };
}

function mapAuditEventRecord(event: AuditEventRow): AtlasOperatorAuditEventRecord {
  const actorLabel =
    event.user?.name ??
    event.user?.email ??
    (event.actorType === "SYSTEM" ? "Atlas system" : event.actorType.toLowerCase());

  return {
    id: event.id,
    eventType: event.eventType,
    targetType: event.targetType,
    targetId: event.targetId,
    actorType: event.actorType,
    actorLabel,
    organizationName: event.organization?.name ?? event.request?.organization?.name ?? null,
    requestTitle: event.request?.title ?? null,
    occurredAt: event.occurredAt.toISOString()
  };
}

function mapOperatorCaseRecord(caseRecord: OperatorCaseQueryRow): AtlasOperatorCaseRecord {
  const request = caseRecord.request;
  const payment = request?.payment ?? null;
  const receipt = request?.receipt ?? null;
  const paused = extractOperatorControls(request?.metadata ?? null).paused;
  const reconciliationState =
    request && payment
      ? deriveAtlasOperatorReconciliationState({
          requestId: request.id,
          requestTitle: request.title,
          buyerOrganizationId: request.organization.id,
          buyerOrganizationName: request.organization.name,
          sellerOrganizationId: request.sellerOrganization?.id ?? null,
          sellerOrganizationName: request.sellerOrganization?.name ?? null,
          requestStatus: request.status,
          paymentId: payment.id,
          paymentStatus: payment.status,
          receiptId: receipt?.id ?? null,
          receiptStatus: receipt?.status ?? null,
          paymentAttemptCount: payment.attempts.length,
          providerStatus: extractProviderStatusFromPayment(payment),
          sellerFulfillmentStatus: extractSellerFulfillmentStatus(request.metadata),
          paused
        })
      : null;

  return {
    id: caseRecord.id,
    caseKey: caseRecord.caseKey,
    category: caseRecord.category,
    severity: caseRecord.severity,
    status: caseRecord.status,
    title: caseRecord.title,
    summary: caseRecord.summary,
    requestId: request?.id ?? null,
    paymentId: payment?.id ?? null,
    paymentRail: payment?.rail ?? null,
    receiptId: receipt?.id ?? null,
    buyerOrganizationId: request?.organization.id ?? null,
    buyerOrganizationName: request?.organization.name ?? null,
    sellerOrganizationId: request?.sellerOrganization?.id ?? null,
    sellerOrganizationName: request?.sellerOrganization?.name ?? null,
    requestTitle: request?.title ?? null,
    requestStatus: request?.status ?? null,
    paymentStatus: payment?.status ?? null,
    receiptStatus: receipt?.status ?? null,
    providerStatus: extractProviderStatusFromPayment(payment),
    reconciliationState,
    attemptCount: payment?.attempts.length ?? 0,
    paused,
    resolutionReason: caseRecord.resolutionReason,
    availableActions: deriveAtlasOperatorAvailableActions({
      status: caseRecord.status,
      paused,
      retryEligible: payment ? isAtlasPaymentRetryEligible(payment.status) : false,
      requestStatus: request?.status ?? null
    }),
    createdAt: caseRecord.createdAt.toISOString(),
    updatedAt: caseRecord.updatedAt.toISOString()
  };
}

async function createOperatorAuditEvent(
  transaction: DatabaseClient,
  actor: AtlasActorContext | null,
  input: {
    organizationId: string | null;
    requestId: string | null;
    targetType: string;
    targetId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
  }
) {
  await transaction.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      userId: actor?.user.id ?? null,
      actorType: actor ? "HUMAN" : "SYSTEM",
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId,
      requestId: input.requestId,
      payload: input.payload
    }
  });
}

async function upsertOperatorNotification(
  transaction: DatabaseClient,
  input: {
    dedupeKey: string;
    organizationId: string;
    caseId: string;
    category: string;
    title: string;
    description: string;
    active: boolean;
  }
) {
  return transaction.notification.upsert({
    where: {
      dedupeKey: input.dedupeKey
    },
    create: {
      dedupeKey: input.dedupeKey,
      organizationId: input.organizationId,
      caseId: input.caseId,
      category: input.category,
      title: input.title,
      description: input.description,
      status: input.active ? "UNREAD" : "READ"
    },
    update: {
      organizationId: input.organizationId,
      caseId: input.caseId,
      category: input.category,
      title: input.title,
      description: input.description,
      status: input.active ? "UNREAD" : "READ"
    }
  });
}

async function syncOperatorCases(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  const requests = await client.spendRequest.findMany({
    include: {
      organization: true,
      sellerOrganization: true,
      payment: {
        include: {
          attempts: true
        }
      },
      receipt: true
    }
  });

  const existingCases = await client.operatorCase.findMany();
  const existingCaseMap = new Map(existingCases.map((item) => [item.caseKey, item]));
  const activeCaseKeys = new Set<string>();

  for (const request of requests) {
    const paused = extractOperatorControls(request.metadata).paused;
    const payment = request.payment;
    const receipt = request.receipt;
    const classification = classifyAtlasOperatorException({
      requestId: request.id,
      requestTitle: request.title,
      buyerOrganizationId: request.organization.id,
      buyerOrganizationName: request.organization.name,
      sellerOrganizationId: request.sellerOrganization?.id ?? null,
      sellerOrganizationName: request.sellerOrganization?.name ?? null,
      requestStatus: request.status,
      paymentId: payment?.id ?? null,
      paymentStatus: payment?.status ?? null,
      receiptId: receipt?.id ?? null,
      receiptStatus: receipt?.status ?? null,
      paymentAttemptCount: payment?.attempts.length ?? 0,
      providerStatus: extractProviderStatusFromPayment(payment),
      sellerFulfillmentStatus: extractSellerFulfillmentStatus(request.metadata),
      paused
    });

    if (!classification) {
      continue;
    }

    const caseKey = buildAtlasOperatorCaseKey(classification.category, request.id);
    activeCaseKeys.add(caseKey);
    const existingCase = existingCaseMap.get(caseKey);
    const stateFingerprint = createOperatorStateFingerprint({
      requestStatus: request.status,
      paymentStatus: payment?.status ?? null,
      receiptStatus: receipt?.status ?? null,
      sellerFulfillmentStatus: extractSellerFulfillmentStatus(request.metadata),
      paused,
      paymentAttemptCount: payment?.attempts.length ?? 0
    });
    const existingCaseMetadata = extractCaseMetadata(existingCase?.metadata ?? null);
    const metadata = {
      managed: true,
      stateFingerprint,
      resolvedStateFingerprint:
        typeof existingCaseMetadata?.resolvedStateFingerprint === "string"
          ? existingCaseMetadata.resolvedStateFingerprint
          : null,
      reconciliationState:
        payment || receipt
          ? deriveAtlasOperatorReconciliationState({
              requestId: request.id,
              requestTitle: request.title,
              buyerOrganizationId: request.organization.id,
              buyerOrganizationName: request.organization.name,
              sellerOrganizationId: request.sellerOrganization?.id ?? null,
              sellerOrganizationName: request.sellerOrganization?.name ?? null,
              requestStatus: request.status,
              paymentId: payment?.id ?? null,
              paymentStatus: payment?.status ?? null,
              receiptId: receipt?.id ?? null,
              receiptStatus: receipt?.status ?? null,
              paymentAttemptCount: payment?.attempts.length ?? 0,
              providerStatus: extractProviderStatusFromPayment(payment),
              sellerFulfillmentStatus: extractSellerFulfillmentStatus(request.metadata),
              paused
            })
          : null,
      providerStatus: extractProviderStatusFromPayment(payment),
      paymentAttemptCount: payment?.attempts.length ?? 0,
      paused
    } satisfies Prisma.InputJsonObject;

    const nextStatus =
      existingCase !== undefined
        ? existingCase.status === "RESOLVED" || existingCase.status === "CLOSED"
          ? existingCaseMetadata?.resolvedStateFingerprint === stateFingerprint
            ? existingCase.status
            : classification.status
          : existingCase.status
        : classification.status;
    const nextCase =
      existingCase !== undefined
        ? await client.operatorCase.update({
            where: {
              id: existingCase.id
            },
            data: {
              organizationId: request.organization.id,
              requestId: request.id,
              category: classification.category,
              severity: classification.severity,
              status: nextStatus,
              title: classification.title,
              summary: classification.summary,
              resolutionReason:
                existingCase.status === "RESOLVED" || existingCase.status === "CLOSED"
                  ? existingCaseMetadata?.resolvedStateFingerprint === stateFingerprint
                    ? existingCase.resolutionReason
                    : null
                  : existingCase.resolutionReason,
              metadata
            }
          })
        : await client.operatorCase.create({
            data: {
              caseKey,
              organizationId: request.organization.id,
              requestId: request.id,
              category: classification.category,
              severity: classification.severity,
              status: classification.status,
              title: classification.title,
              summary: classification.summary,
              metadata
            }
          });

    await upsertOperatorNotification(client, {
      dedupeKey: `operator-case:${caseKey}`,
      organizationId: actor.organization.id,
      caseId: nextCase.id,
      category: classification.category,
      title: classification.title,
      description: classification.summary,
      active: nextStatus !== "RESOLVED" && nextStatus !== "CLOSED"
    });

    if (!existingCase) {
      await createOperatorAuditEvent(client, null, {
        organizationId: actor.organization.id,
        requestId: request.id,
        targetType: "OperatorCase",
        targetId: nextCase.id,
        eventType: "operator.case_opened",
        payload: {
          caseKey,
          category: classification.category,
          severity: classification.severity
        }
      });
    }
  }

  const staleCases = existingCases.filter(
    (item) => (item.status === "OPEN" || item.status === "INVESTIGATING" || item.status === "ACTION_REQUIRED") && !activeCaseKeys.has(item.caseKey)
  );

  for (const staleCase of staleCases) {
    const resolved = await client.operatorCase.update({
      where: {
        id: staleCase.id
      },
      data: {
        status: "RESOLVED",
        resolutionReason: staleCase.resolutionReason ?? "Lifecycle state no longer matches the original exception trigger."
      }
    });

    await upsertOperatorNotification(client, {
      dedupeKey: `operator-case:${staleCase.caseKey}`,
      organizationId: actor.organization.id,
      caseId: resolved.id,
      category: staleCase.category,
      title: resolved.title,
      description: resolved.summary,
      active: false
    });

    await createOperatorAuditEvent(client, null, {
      organizationId: actor.organization.id,
      requestId: staleCase.requestId,
      targetType: "OperatorCase",
      targetId: resolved.id,
      eventType: "operator.case_resolved",
      payload: {
        caseKey: staleCase.caseKey,
        resolutionReason: resolved.resolutionReason
      }
    });
  }
}

async function loadOperatorCaseRows(client: DatabaseClient = prisma) {
  return client.operatorCase.findMany({
    include: {
      request: {
        include: {
          organization: true,
          sellerOrganization: true,
          payment: {
            include: {
              attempts: true
            }
          },
          receipt: true
        }
      },
      actions: {
        include: {
          actorUser: true
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      notifications: {
        orderBy: {
          createdAt: "desc"
        }
      }
    },
    orderBy: [
      {
        updatedAt: "desc"
      },
      {
        createdAt: "desc"
      }
    ]
  });
}

function sortOperatorCases(left: AtlasOperatorCaseRecord, right: AtlasOperatorCaseRecord) {
  const severityOrder = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  } as const;

  return (
    severityOrder[right.severity] - severityOrder[left.severity] ||
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export async function listOperatorCases(actor: AtlasActorContext, rawFilters?: unknown, client: DatabaseClient = prisma) {
  try {
    const filters = atlasOperatorCaseFiltersSchema.parse(rawFilters ?? {});
    await syncOperatorCases(actor, client);
    const rows = await loadOperatorCaseRows(client);

    return rows
      .map(mapOperatorCaseRecord)
      .filter((item) => {
        if (filters.status && item.status !== filters.status) {
          return false;
        }

        if (filters.category && item.category !== filters.category) {
          return false;
        }

        if (filters.severity && item.severity !== filters.severity) {
          return false;
        }

        if (
          !matchesAtlasOperatorTextFilter(
            [item.title, item.summary, item.requestTitle, item.buyerOrganizationName, item.sellerOrganizationName]
              .filter(Boolean)
              .join(" "),
            filters.query
          )
        ) {
          return false;
        }

        return true;
      })
      .sort(sortOperatorCases);
  } catch (error) {
    normalizeValidationError(error);
  }
}

export async function getOperatorCase(actor: AtlasActorContext, caseId: string, client: DatabaseClient = prisma) {
  await syncOperatorCases(actor, client);
  const row = await client.operatorCase.findUnique({
    where: {
      id: caseId
    },
    include: {
      request: {
        include: {
          organization: true,
          sellerOrganization: true,
          payment: {
            include: {
              attempts: true
            }
          },
          receipt: true
        }
      },
      actions: {
        include: {
          actorUser: true
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      notifications: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!row) {
    return null;
  }

  const auditEvents = await client.auditEvent.findMany({
    where: {
      OR: [
        {
          requestId: row.requestId ?? undefined
        },
        {
          targetType: "OperatorCase",
          targetId: row.id
        }
      ]
    },
    include: {
      organization: true,
      user: true,
      request: {
        include: {
          organization: true
        }
      }
    },
    orderBy: {
      occurredAt: "desc"
    },
    take: 20
  });

  return {
    item: mapOperatorCaseRecord(row),
    actions: row.actions.map(mapOperatorActionRecord),
    notifications: row.notifications.map(mapOperatorNotificationRecord),
    auditEvents: auditEvents.map(mapAuditEventRecord)
  } satisfies AtlasOperatorCaseDetailRecord;
}

export async function listOperatorNotifications(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  await syncOperatorCases(actor, client);

  const notifications = await client.notification.findMany({
    where: {
      organizationId: actor.organization.id
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 25
  });

  return notifications.map((notification) => ({
    id: notification.id,
    dedupeKey: notification.dedupeKey,
    caseId: notification.caseId,
    category: notification.category,
    title: notification.title,
    description: notification.description,
    status: notification.status,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString()
  })) satisfies AtlasOperatorNotificationRecord[];
}

export async function listOperatorAuditEvents(_actor: AtlasActorContext, rawFilters?: unknown, client: DatabaseClient = prisma) {
  try {
    const filters = atlasOperatorAuditFiltersSchema.parse(rawFilters ?? {});
    const events = await client.auditEvent.findMany({
      include: {
        organization: true,
        user: true,
        request: {
          include: {
            organization: true
          }
        }
      },
      orderBy: {
        occurredAt: "desc"
      },
      take: 100
    });

    return events
      .map(mapAuditEventRecord)
      .filter((event) => {
        if (filters.eventType && event.eventType !== filters.eventType) {
          return false;
        }

        if (filters.targetType && event.targetType !== filters.targetType) {
          return false;
        }

        if (
          !matchesAtlasOperatorTextFilter(
            [event.eventType, event.targetType, event.targetId, event.actorLabel, event.organizationName, event.requestTitle]
              .filter(Boolean)
              .join(" "),
            filters.query
          )
        ) {
          return false;
        }

        return true;
      });
  } catch (error) {
    normalizeValidationError(error);
  }
}

export async function getOperatorOverview(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  await syncOperatorCases(actor, client);
  const [cases, notifications, auditEvents] = await Promise.all([
    listOperatorCases(actor, {}, client),
    listOperatorNotifications(actor, client),
    listOperatorAuditEvents(actor, {}, client)
  ]);

  return {
    openCaseCount: cases.filter((item) => item.status === "OPEN" || item.status === "INVESTIGATING").length,
    criticalCaseCount: cases.filter((item) => item.severity === "CRITICAL").length,
    actionRequiredCount: cases.filter((item) => item.status === "ACTION_REQUIRED").length,
    unreadNotificationCount: notifications.filter((item) => item.status === "UNREAD").length,
    delayedCaseCount: cases.filter(
      (item) => item.category === "SETTLEMENT_DELAY" || item.category === "SELLER_CONFIRMATION_DELAY" || item.category === "RECEIPT_PENDING"
    ).length,
    failedCaseCount: cases.filter(
      (item) => item.category === "PAYMENT_FAILURE" || item.category === "PAYMENT_RETRY_EXHAUSTED" || item.category === "RECEIPT_FAILURE"
    ).length,
    recentCases: cases.slice(0, 6),
    recentNotifications: notifications.slice(0, 6),
    recentAuditEvents: auditEvents.slice(0, 8)
  } satisfies AtlasOperatorOverviewRecord;
}

async function createOperatorAction(
  transaction: Prisma.TransactionClient,
  actor: AtlasActorContext,
  caseId: string,
  input: {
    actionType: AtlasOperatorActionRecord["actionType"];
    reason: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return transaction.operatorAction.create({
    data: {
      caseId,
      actorUserId: actor.user.id,
      actionType: input.actionType,
      reason: input.reason,
      metadata: input.metadata
    },
    include: {
      actorUser: true
    }
  });
}

async function markCaseNotificationStatus(
  transaction: Prisma.TransactionClient,
  caseId: string,
  status: "UNREAD" | "READ"
) {
  await transaction.notification.updateMany({
    where: {
      caseId
    },
    data: {
      status
    }
  });
}

export async function performOperatorCaseAction(actor: AtlasActorContext, caseId: string, rawInput: unknown) {
  try {
    const input = atlasOperatorCaseActionSchema.parse(rawInput);
    const detail = await getOperatorCase(actor, caseId);

    if (!detail) {
      throw new AtlasOperatorWorkflowError("The selected operator case could not be found.", "not_found");
    }

    if (!detail.item.availableActions.includes(input.actionType)) {
      throw new AtlasOperatorWorkflowError("That operator action is not allowed for the current case state.", "conflict");
    }

    if (!detail.item.requestId) {
      throw new AtlasOperatorWorkflowError("Operator actions require a request-backed case.", "bad_request");
    }

    if (input.actionType === "REQUEUE_PAYMENT") {
      const payment = await executeOperatorPayment(actor, detail.item.requestId, {
        rail: detail.item.paymentRail ?? "INTERNAL_SIMULATED"
      });

      await prisma.$transaction(async (transaction) => {
        await createOperatorAction(transaction, actor, caseId, {
          actionType: input.actionType,
          reason: input.reason,
          metadata: {
            paymentId: payment.id,
            paymentRail: payment.rail,
            paymentStatus: payment.status
          }
        });
        await transaction.operatorCase.update({
          where: {
            id: caseId
          },
          data: {
            status: "INVESTIGATING",
            resolutionReason: null
          }
        });
        await markCaseNotificationStatus(transaction, caseId, "UNREAD");
        await createOperatorAuditEvent(transaction, actor, {
          organizationId: actor.organization.id,
          requestId: detail.item.requestId,
          targetType: "OperatorCase",
          targetId: caseId,
          eventType: "operator.payment_requeued",
          payload: {
            reason: input.reason,
            paymentId: payment.id,
            rail: payment.rail
          }
        });
      });

      return getOperatorCase(actor, caseId);
    }

    await prisma.$transaction(async (transaction) => {
      const currentCase = await transaction.operatorCase.findUnique({
        where: {
          id: caseId
        }
      });
      const currentCaseMetadata = extractCaseMetadata(currentCase?.metadata ?? null) ?? {};

      if (input.actionType === "PAUSE_REQUEST") {
        const request = await transaction.spendRequest.findUnique({
          where: {
            id: detail.item.requestId!
          }
        });

        await transaction.spendRequest.update({
          where: {
            id: detail.item.requestId!
          },
          data: {
            metadata: createOperatorControlsMetadata(request?.metadata ?? null, {
              paused: true,
              reason: input.reason,
              actorUserId: actor.user.id
            })
          }
        });
      }

      if (input.actionType === "RELEASE_REQUEST") {
        const request = await transaction.spendRequest.findUnique({
          where: {
            id: detail.item.requestId!
          }
        });

        await transaction.spendRequest.update({
          where: {
            id: detail.item.requestId!
          },
          data: {
            metadata: createOperatorControlsMetadata(request?.metadata ?? null, {
              paused: false,
              reason: input.reason,
              actorUserId: actor.user.id
            })
          }
        });
      }

      await createOperatorAction(transaction, actor, caseId, {
        actionType: input.actionType,
        reason: input.reason
      });

      await transaction.operatorCase.update({
        where: {
          id: caseId
        },
        data: {
          status:
            input.actionType === "ANNOTATE_CASE"
              ? "INVESTIGATING"
              : input.actionType === "RESOLVE_CASE"
                ? "RESOLVED"
                : input.actionType === "PAUSE_REQUEST"
                  ? "ACTION_REQUIRED"
                  : "INVESTIGATING",
          resolutionReason: input.actionType === "RESOLVE_CASE" ? input.reason : null,
          metadata:
            input.actionType === "RESOLVE_CASE"
              ? asInputJsonValue({
                  ...currentCaseMetadata,
                  resolvedStateFingerprint:
                    typeof currentCaseMetadata.stateFingerprint === "string" ? currentCaseMetadata.stateFingerprint : null
                })
              : asInputJsonValue(currentCaseMetadata)
        }
      });

      await markCaseNotificationStatus(transaction, caseId, input.actionType === "RESOLVE_CASE" ? "READ" : "UNREAD");

      await createOperatorAuditEvent(transaction, actor, {
        organizationId: actor.organization.id,
        requestId: detail.item.requestId,
        targetType: "OperatorCase",
        targetId: caseId,
        eventType:
          input.actionType === "PAUSE_REQUEST"
            ? "operator.request_paused"
            : input.actionType === "RELEASE_REQUEST"
              ? "operator.request_released"
              : input.actionType === "ANNOTATE_CASE"
                ? "operator.case_annotated"
                : "operator.case_resolved",
        payload: {
          reason: input.reason,
          actionType: input.actionType
        }
      });
    });

    return getOperatorCase(actor, caseId);
  } catch (error) {
    normalizeValidationError(error);
  }
}
