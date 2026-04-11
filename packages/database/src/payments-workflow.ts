import type { AtlasActorContext } from "@atlas/auth";
import {
  atlasPaymentExecutionSchema,
  determineAtlasSimulatedPaymentScenario,
  formatAtlasPaymentRailLabel,
  isAtlasPaymentExecutionEligible,
  isAtlasPaymentRetryEligible,
  resolveAtlasReceiptStatus,
  type AtlasPaymentAttemptRecord,
  type AtlasPaymentIntentRecord,
  type AtlasReceiptRecord
} from "@atlas/domain";
import { ZodError } from "zod";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";

export class AtlasPaymentsWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "not_found" | "conflict" | "forbidden"
  ) {
    super(message);
    this.name = "AtlasPaymentsWorkflowError";
  }
}

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

function normalizeValidationError(error: unknown): never {
  if (error instanceof AtlasPaymentsWorkflowError) {
    throw error;
  }

  if (error instanceof ZodError) {
    throw new AtlasPaymentsWorkflowError(error.issues.map((issue) => issue.message).join("; "), "bad_request");
  }

  throw error;
}

function asJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asInputJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
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

function extractScenarioKey(metadata: Prisma.JsonValue | null) {
  const metadataObject = asJsonObject(metadata);
  const scenarioKey = metadataObject?.scenarioKey;
  return typeof scenarioKey === "string" && scenarioKey.trim().length > 0 ? scenarioKey : null;
}

function mapPaymentAttemptRecord(attempt: {
  id: string;
  paymentId: string;
  attemptNumber: number;
  rail: string;
  status: string;
  reference: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
}): AtlasPaymentAttemptRecord {
  return {
    id: attempt.id,
    paymentId: attempt.paymentId,
    attemptNumber: attempt.attemptNumber,
    rail: attempt.rail as AtlasPaymentAttemptRecord["rail"],
    status: attempt.status as AtlasPaymentAttemptRecord["status"],
    reference: attempt.reference,
    errorCode: attempt.errorCode,
    errorMessage: attempt.errorMessage,
    createdAt: attempt.createdAt.toISOString()
  };
}

function mapPaymentIntentRecord(payment: {
  id: string;
  requestId: string;
  rail: string;
  provider: string;
  reference: string | null;
  status: string;
  amountMinor: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  organization: { id: string; name: string };
  sellerOrganization: { id: string; name: string } | null;
  attempts: Array<{
    id: string;
    paymentId: string;
    attemptNumber: number;
    rail: string;
    status: string;
    reference: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
  }>;
}): AtlasPaymentIntentRecord {
  const attempts = payment.attempts
    .slice()
    .sort((left, right) => right.attemptNumber - left.attemptNumber)
    .map(mapPaymentAttemptRecord);
  const latestAttempt = attempts[0] ?? null;

  return {
    id: payment.id,
    requestId: payment.requestId,
    buyerOrganizationId: payment.organization.id,
    buyerOrganizationName: payment.organization.name,
    sellerOrganizationId: payment.sellerOrganization?.id ?? null,
    sellerOrganizationName: payment.sellerOrganization?.name ?? null,
    rail: payment.rail as AtlasPaymentIntentRecord["rail"],
    status: payment.status as AtlasPaymentIntentRecord["status"],
    provider: payment.provider,
    reference: payment.reference,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    latestAttemptNumber: latestAttempt?.attemptNumber ?? 0,
    latestAttemptStatus: latestAttempt?.status ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    attempts
  };
}

function mapReceiptRecord(receipt: {
  id: string;
  requestId: string;
  status: string;
  storageKey: string | null;
  contentType: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Prisma.JsonValue | null;
  organization: { id: string; name: string };
}): AtlasReceiptRecord {
  const metadata = asJsonObject(receipt.metadata);
  const paymentReference = typeof metadata?.paymentReference === "string" ? metadata.paymentReference : null;

  return {
    id: receipt.id,
    requestId: receipt.requestId,
    buyerOrganizationId: receipt.organization.id,
    buyerOrganizationName: receipt.organization.name,
    status: receipt.status as AtlasReceiptRecord["status"],
    storageKey: receipt.storageKey,
    contentType: receipt.contentType,
    paymentReference,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString()
  };
}

async function createAuditEvent(
  transaction: Prisma.TransactionClient,
  actor: AtlasActorContext,
  input: {
    requestId: string;
    targetType: string;
    targetId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
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
      requestId: input.requestId,
      payload: input.payload
    }
  });
}

export async function listPaymentIntents(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  const where =
    actor.workspace === "BUYER"
      ? { organizationId: actor.organization.id }
      : actor.workspace === "SELLER"
        ? { sellerOrganizationId: actor.organization.id }
        : {};

  const payments = await client.payment.findMany({
    where,
    include: {
      organization: {
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
      attempts: {
        orderBy: {
          attemptNumber: "desc"
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return payments.map(mapPaymentIntentRecord);
}

export async function getPaymentIntent(actor: AtlasActorContext, paymentId: string, client: DatabaseClient = prisma) {
  const payment =
    (await client.payment.findUnique({
      where: {
        id: paymentId
      },
      include: {
        organization: {
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
        attempts: {
          orderBy: {
            attemptNumber: "desc"
          }
        }
      }
    })) ??
    (await client.payment.findUnique({
      where: {
        requestId: paymentId
      },
      include: {
        organization: {
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
        attempts: {
          orderBy: {
            attemptNumber: "desc"
          }
        }
      }
    }));

  if (!payment) {
    return null;
  }

  if (actor.workspace === "BUYER" && payment.organizationId !== actor.organization.id) {
    return null;
  }

  if (actor.workspace === "SELLER" && payment.sellerOrganizationId !== actor.organization.id) {
    return null;
  }

  return mapPaymentIntentRecord(payment);
}

export async function listReceiptRecords(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  const where =
    actor.workspace === "BUYER"
      ? {
          organizationId: actor.organization.id
        }
      : actor.workspace === "SELLER"
        ? {
            request: {
              sellerOrganizationId: actor.organization.id
            }
          }
        : {};

  const receipts = await client.receipt.findMany({
    where,
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

  return receipts.map(mapReceiptRecord);
}

export async function getReceiptRecord(actor: AtlasActorContext, receiptId: string, client: DatabaseClient = prisma) {
  const receipt =
    (await client.receipt.findUnique({
      where: {
        id: receiptId
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        },
        request: {
          select: {
            sellerOrganizationId: true
          }
        }
      }
    })) ??
    (await client.receipt.findUnique({
      where: {
        requestId: receiptId
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        },
        request: {
          select: {
            sellerOrganizationId: true
          }
        }
      }
    }));

  if (!receipt) {
    return null;
  }

  if (actor.workspace === "BUYER" && receipt.organizationId !== actor.organization.id) {
    return null;
  }

  if (actor.workspace === "SELLER" && receipt.request?.sellerOrganizationId !== actor.organization.id) {
    return null;
  }

  return mapReceiptRecord(receipt);
}

export async function executeBuyerPayment(actor: AtlasActorContext, requestId: string, rawInput: unknown) {
  try {
    const input = atlasPaymentExecutionSchema.parse(rawInput);

    if (input.rail !== "INTERNAL_SIMULATED") {
      throw new AtlasPaymentsWorkflowError(
        `${formatAtlasPaymentRailLabel(input.rail)} execution is not implemented in the current Phase 4 baseline.`,
        "bad_request"
      );
    }

    return await prisma.$transaction(async (transaction) => {
      const request = await transaction.spendRequest.findFirst({
        where: {
          id: requestId,
          organizationId: actor.organization.id
        },
        include: {
          organization: {
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
          payment: {
            include: {
              attempts: {
                orderBy: {
                  attemptNumber: "desc"
                }
              }
            }
          },
          receipt: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      if (!request) {
        throw new AtlasPaymentsWorkflowError("The selected request is not available in this buyer organization.", "not_found");
      }

      if (!request.sellerOrganizationId) {
        throw new AtlasPaymentsWorkflowError("The request must target a seller organization before payment can execute.", "bad_request");
      }

      if (!isAtlasPaymentExecutionEligible(request.status)) {
        throw new AtlasPaymentsWorkflowError("Only approved or executing requests can enter payment execution.", "conflict");
      }

      if (request.payment && !isAtlasPaymentRetryEligible(request.payment.status)) {
        throw new AtlasPaymentsWorkflowError(
          "A payment already exists for this request and is not currently retry eligible.",
          "conflict"
        );
      }

      const scenarioKey = extractScenarioKey(request.metadata);
      const simulatedScenario = determineAtlasSimulatedPaymentScenario({
        scenarioKey,
        serviceCategory: request.serviceCategory,
        amountMinor: request.amountMinor
      });
      const sellerFulfillmentStatus = extractSellerFulfillmentStatus(request.metadata);
      const attemptNumber = (request.payment?.attempts[0]?.attemptNumber ?? 0) + 1;
      const reference = `sim-${request.id}-${simulatedScenario.referenceSuffix}-${String(attemptNumber).padStart(2, "0")}`;
      const provider = input.rail === "STRIPE" ? "stripe" : "simulated";

      const payment =
        request.payment ??
        (await transaction.payment.create({
          data: {
            requestId: request.id,
            organizationId: request.organizationId,
            sellerOrganizationId: request.sellerOrganizationId,
            rail: input.rail,
            provider,
            status: "PENDING",
            amountMinor: request.amountMinor,
            currency: request.currency,
            metadata: {
              scenarioKey,
              createdByUserId: actor.user.id
            }
          },
          include: {
            organization: {
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
            attempts: {
              orderBy: {
                attemptNumber: "desc"
              }
            }
          }
        }));

      if (!request.payment) {
        await createAuditEvent(transaction, actor, {
          requestId: request.id,
          targetType: "Payment",
          targetId: payment.id,
          eventType: "payment.intent_created",
          payload: {
            rail: input.rail,
            provider
          }
        });
      }

      const paymentAttempt = await transaction.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber,
          rail: input.rail,
          status: simulatedScenario.outcome,
          reference,
          evidence: asInputJsonValue({
            ...simulatedScenario.evidence,
            scenarioKey,
            requestStatusBeforeExecution: request.status
          }),
          errorCode: simulatedScenario.outcome === "FAILED" ? "SIMULATED_SETTLEMENT_FAILURE" : null,
          errorMessage:
            simulatedScenario.outcome === "FAILED" ? "Simulated rail rejected the payment attempt." : null
        }
      });

      await createAuditEvent(transaction, actor, {
        requestId: request.id,
        targetType: "PaymentAttempt",
        targetId: paymentAttempt.id,
        eventType: "payment.attempt_started",
        payload: {
          rail: input.rail,
          attemptNumber,
          reference
        }
      });

      const nextRequestStatus =
        simulatedScenario.outcome === "FAILED" || simulatedScenario.outcome === "VOIDED"
          ? "FAILED"
          : simulatedScenario.outcome === "CAPTURED" && sellerFulfillmentStatus === "DELIVERED"
            ? "COMPLETED"
            : simulatedScenario.outcome === "CAPTURED" && sellerFulfillmentStatus === "FAILED"
              ? "FAILED"
              : "EXECUTING";
      const nextReceiptStatus = resolveAtlasReceiptStatus({
        paymentStatus: simulatedScenario.outcome,
        sellerFulfillmentStatus
      });
      const receiptStorageKey = `receipts/${request.id}.json`;
      const paymentMetadata = {
        ...((asJsonObject(payment.metadata) ?? {}) as Prisma.InputJsonObject),
        scenarioKey,
        latestAttemptNumber: attemptNumber,
        latestReference: reference,
        latestOutcome: simulatedScenario.outcome,
        latestEvidence: asInputJsonValue(simulatedScenario.evidence)
      } satisfies Prisma.InputJsonObject;
      const receiptMetadata = {
        scenarioKey,
        rail: input.rail,
        paymentReference: reference,
        paymentStatus: simulatedScenario.outcome,
        sellerFulfillmentStatus,
        attemptNumber
      } satisfies Prisma.InputJsonObject;

      await transaction.payment.update({
        where: {
          id: payment.id
        },
        data: {
          rail: input.rail,
          provider,
          reference,
          status: simulatedScenario.outcome,
          metadata: paymentMetadata
        }
      });

      await transaction.spendRequest.update({
        where: {
          id: request.id
        },
        data: {
          status: nextRequestStatus
        }
      });

      const receipt =
        request.receipt ??
        (await transaction.receipt.create({
          data: {
            requestId: request.id,
            organizationId: request.organizationId,
            status: "PENDING",
            storageKey: null,
            contentType: "application/json",
            metadata: {
              scenarioKey
            }
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }));

      await transaction.receipt.update({
        where: {
          id: receipt.id
        },
        data: {
          status: nextReceiptStatus,
          storageKey: nextReceiptStatus === "AVAILABLE" || nextReceiptStatus === "FAILED" ? receiptStorageKey : null,
          contentType: "application/json",
          metadata: receiptMetadata
        }
      });

      await createAuditEvent(transaction, actor, {
        requestId: request.id,
        targetType: "Payment",
        targetId: payment.id,
        eventType:
          simulatedScenario.outcome === "FAILED"
            ? "payment.failed"
            : simulatedScenario.outcome === "AUTHORIZED"
              ? "payment.authorized"
              : simulatedScenario.outcome === "PENDING"
                ? "payment.pending"
                : "payment.captured",
        payload: {
          rail: input.rail,
          attemptNumber,
          reference,
          outcome: simulatedScenario.outcome
        }
      });

      if (nextReceiptStatus === "AVAILABLE" || nextReceiptStatus === "FAILED") {
        await createAuditEvent(transaction, actor, {
          requestId: request.id,
          targetType: "Receipt",
          targetId: receipt.id,
          eventType: "receipt.finalized",
          payload: {
            status: nextReceiptStatus,
            storageKey: receiptStorageKey
          }
        });
      }

      const refreshed = await transaction.payment.findFirstOrThrow({
        where: {
          id: payment.id
        },
        include: {
          organization: {
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
          attempts: {
            orderBy: {
              attemptNumber: "desc"
            }
          }
        }
      });

      return mapPaymentIntentRecord(refreshed);
    });
  } catch (error) {
    normalizeValidationError(error);
  }
}
