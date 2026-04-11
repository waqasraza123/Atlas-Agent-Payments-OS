import type { AtlasActorContext } from "@atlas/auth";
import { paymentRuntime } from "@atlas/config";
import {
  atlasPaymentMaximumAttemptCount,
  atlasPaymentExecutionSchema,
  deriveAtlasPaymentReconciliationState,
  determineAtlasSimulatedPaymentScenario,
  formatAtlasPaymentRailLabel,
  isAtlasPaymentAttemptLimitReached,
  isAtlasPaymentExecutionEligible,
  isAtlasPaymentRetryEligible,
  isAtlasStripePaymentIntentStatus,
  normalizeAtlasStripePaymentStatus,
  resolveAtlasReceiptStatus,
  summarizeAtlasReceiptEvidence,
  type AtlasPaymentAttemptRecord,
  type AtlasPaymentIntentRecord,
  type AtlasReceiptRecord
} from "@atlas/domain";
import Stripe from "stripe";
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

type PaymentExecutionResolution = {
  provider: string;
  reference: string;
  normalizedStatus: AtlasPaymentAttemptRecord["status"];
  providerStatus: string;
  evidence: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
};

let atlasStripeClient: Stripe | null | undefined;

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

function getAtlasStripeClient() {
  if (atlasStripeClient !== undefined) {
    return atlasStripeClient;
  }

  if (!paymentRuntime.stripeSecretKey) {
    atlasStripeClient = null;
    return atlasStripeClient;
  }

  atlasStripeClient = new Stripe(paymentRuntime.stripeSecretKey);
  return atlasStripeClient;
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

function extractProviderStatus(value: Prisma.JsonValue | null) {
  const metadataObject = asJsonObject(value);
  const providerStatus = metadataObject?.providerStatus;
  return typeof providerStatus === "string" && providerStatus.trim().length > 0 ? providerStatus : null;
}

function extractLatestAttemptProviderStatus(attempts: Array<{ evidence: Prisma.JsonValue | null }>) {
  for (const attempt of attempts) {
    const providerStatus = extractProviderStatus(attempt.evidence);

    if (providerStatus) {
      return providerStatus;
    }
  }

  return null;
}

function mapPaymentAttemptRecord(attempt: {
  id: string;
  paymentId: string;
  attemptNumber: number;
  rail: string;
  status: string;
  reference: string | null;
  evidence: Prisma.JsonValue | null;
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
    providerStatus: extractProviderStatus(attempt.evidence),
    evidence: asJsonObject(attempt.evidence),
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
  request: {
    status: string;
    metadata: Prisma.JsonValue | null;
    receipt: {
      status: string;
    } | null;
  };
  organization: { id: string; name: string };
  sellerOrganization: { id: string; name: string } | null;
  attempts: Array<{
    id: string;
    paymentId: string;
    attemptNumber: number;
    rail: string;
    status: string;
    reference: string | null;
    evidence: Prisma.JsonValue | null;
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
  const sellerFulfillmentStatus = extractSellerFulfillmentStatus(payment.request.metadata);
  const receiptStatus = payment.request.receipt?.status as AtlasPaymentIntentRecord["receiptStatus"];

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
    requestStatus: payment.request.status,
    receiptStatus: receiptStatus ?? null,
    sellerFulfillmentStatus,
    retryEligible: isAtlasPaymentRetryEligible(payment.status as AtlasPaymentIntentRecord["status"]),
    reconciliationState: deriveAtlasPaymentReconciliationState({
      requestStatus: payment.request.status,
      paymentStatus: payment.status as AtlasPaymentIntentRecord["status"],
      receiptStatus: receiptStatus ?? null,
      sellerFulfillmentStatus
    }),
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
  request: {
    title: string;
    status: string;
    serviceCategory: string;
    amountMinor: number;
    currency: string;
    metadata: Prisma.JsonValue | null;
    sellerOrganization: { id: string; name: string } | null;
    payment: {
      status: string;
      rail: string;
      reference: string | null;
      amountMinor: number;
      currency: string;
      metadata: Prisma.JsonValue | null;
      attempts: Array<{
        evidence: Prisma.JsonValue | null;
      }>;
    } | null;
  };
}): AtlasReceiptRecord {
  const metadata = asJsonObject(receipt.metadata);
  const paymentReference = typeof metadata?.paymentReference === "string" ? metadata.paymentReference : null;
  const paymentStatus =
    typeof metadata?.paymentStatus === "string"
      ? metadata.paymentStatus
      : receipt.request.payment?.status ?? null;
  const sellerFulfillmentStatus =
    metadata?.sellerFulfillmentStatus === "DELIVERED" || metadata?.sellerFulfillmentStatus === "FAILED"
      ? metadata.sellerFulfillmentStatus
      : extractSellerFulfillmentStatus(receipt.request.metadata);
  const rail = typeof metadata?.rail === "string" ? metadata.rail : receipt.request.payment?.rail ?? null;
  const paymentMetadata = asJsonObject(receipt.request.payment?.metadata ?? null);
  const providerStatus =
    (typeof metadata?.providerStatus === "string" ? metadata.providerStatus : null) ||
    (typeof paymentMetadata?.latestProviderStatus === "string" ? paymentMetadata.latestProviderStatus : null) ||
    extractLatestAttemptProviderStatus(receipt.request.payment?.attempts ?? []);
  const attemptCount = receipt.request.payment?.attempts.length ?? 0;
  const reconciliationState = deriveAtlasPaymentReconciliationState({
    requestStatus: receipt.request.status,
    paymentStatus: paymentStatus as AtlasReceiptRecord["paymentStatus"],
    receiptStatus: receipt.status as AtlasReceiptRecord["status"],
    sellerFulfillmentStatus
  });

  return {
    id: receipt.id,
    requestId: receipt.requestId,
    buyerOrganizationId: receipt.organization.id,
    buyerOrganizationName: receipt.organization.name,
    sellerOrganizationId: receipt.request.sellerOrganization?.id ?? null,
    sellerOrganizationName: receipt.request.sellerOrganization?.name ?? null,
    requestTitle: receipt.request.title,
    requestStatus: receipt.request.status,
    serviceCategory: receipt.request.serviceCategory,
    status: receipt.status as AtlasReceiptRecord["status"],
    amountMinor: receipt.request.amountMinor,
    currency: receipt.request.currency,
    storageKey: receipt.storageKey,
    contentType: receipt.contentType,
    paymentReference,
    paymentStatus: paymentStatus as AtlasReceiptRecord["paymentStatus"],
    sellerFulfillmentStatus,
    rail: rail as AtlasReceiptRecord["rail"],
    providerStatus,
    attemptCount,
    reconciliationState,
    evidenceSummary: summarizeAtlasReceiptEvidence({
      reconciliationState,
      paymentReference,
      providerStatus,
      paymentStatus: paymentStatus as AtlasReceiptRecord["paymentStatus"],
      sellerFulfillmentStatus,
      storageKey: receipt.storageKey,
      attemptCount
    }),
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

async function executeInternalSimulatedRail(input: {
  requestId: string;
  requestStatus: string;
  scenarioKey: string | null;
  serviceCategory: string;
  amountMinor: number;
  currency: string;
  attemptNumber: number;
}): Promise<PaymentExecutionResolution> {
  const simulatedScenario = determineAtlasSimulatedPaymentScenario({
    scenarioKey: input.scenarioKey,
    serviceCategory: input.serviceCategory,
    amountMinor: input.amountMinor
  });
  const reference = `sim-${input.requestId}-${simulatedScenario.referenceSuffix}-${String(input.attemptNumber).padStart(2, "0")}`;

  return {
    provider: "simulated",
    reference,
    normalizedStatus: simulatedScenario.outcome,
    providerStatus: simulatedScenario.outcome.toLowerCase(),
    evidence: {
      ...simulatedScenario.evidence,
      providerStatus: simulatedScenario.outcome.toLowerCase(),
      requestStatusBeforeExecution: input.requestStatus
    },
    errorCode: simulatedScenario.outcome === "FAILED" ? "SIMULATED_SETTLEMENT_FAILURE" : null,
    errorMessage: simulatedScenario.outcome === "FAILED" ? "Simulated rail rejected the payment attempt." : null
  };
}

async function executeStripeRail(input: {
  requestId: string;
  organizationId: string;
  sellerOrganizationId: string;
  amountMinor: number;
  currency: string;
  attemptNumber: number;
}): Promise<PaymentExecutionResolution> {
  const stripe = getAtlasStripeClient();

  if (!stripe) {
    throw new AtlasPaymentsWorkflowError("Stripe rail is not configured in this environment.", "bad_request");
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: input.amountMinor,
    currency: input.currency.toLowerCase(),
    automatic_payment_methods: {
      enabled: true
    },
    metadata: {
      atlasRequestId: input.requestId,
      atlasBuyerOrganizationId: input.organizationId,
      atlasSellerOrganizationId: input.sellerOrganizationId,
      atlasAttemptNumber: String(input.attemptNumber)
    }
  });

  const providerStatus = isAtlasStripePaymentIntentStatus(paymentIntent.status) ? paymentIntent.status : "processing";

  return {
    provider: "stripe",
    reference: paymentIntent.id,
    normalizedStatus: normalizeAtlasStripePaymentStatus(providerStatus),
    providerStatus,
    evidence: {
      providerStatus,
      paymentIntentId: paymentIntent.id,
      livemode: paymentIntent.livemode,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency
    },
    errorCode: null,
    errorMessage: null
  };
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
      request: {
        select: {
          status: true,
          metadata: true,
          receipt: {
            select: {
              status: true
            }
          }
        }
      },
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
        request: {
          select: {
            status: true,
            metadata: true,
            receipt: {
              select: {
                status: true
              }
            }
          }
        },
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
        request: {
          select: {
            status: true,
            metadata: true,
            receipt: {
              select: {
                status: true
              }
            }
          }
        },
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
      },
      request: {
        select: {
          title: true,
          status: true,
          serviceCategory: true,
          amountMinor: true,
          currency: true,
          metadata: true,
          sellerOrganization: {
            select: {
              id: true,
              name: true
            }
          },
          payment: {
            select: {
              status: true,
              rail: true,
              reference: true,
              amountMinor: true,
              currency: true,
              metadata: true,
              attempts: {
                orderBy: {
                  attemptNumber: "desc"
                },
                select: {
                  evidence: true
                }
              }
            }
          }
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
            id: true,
            title: true,
            status: true,
            serviceCategory: true,
            amountMinor: true,
            currency: true,
            metadata: true,
            sellerOrganizationId: true,
            sellerOrganization: {
              select: {
                id: true,
                name: true
              }
            },
            payment: {
              select: {
                status: true,
                rail: true,
                reference: true,
                amountMinor: true,
                currency: true,
                metadata: true,
                attempts: {
                  orderBy: {
                    attemptNumber: "desc"
                  },
                  select: {
                    evidence: true
                  }
                }
              }
            }
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
            id: true,
            title: true,
            status: true,
            serviceCategory: true,
            amountMinor: true,
            currency: true,
            metadata: true,
            sellerOrganizationId: true,
            sellerOrganization: {
              select: {
                id: true,
                name: true
              }
            },
            payment: {
              select: {
                status: true,
                rail: true,
                reference: true,
                amountMinor: true,
                currency: true,
                metadata: true,
                attempts: {
                  orderBy: {
                    attemptNumber: "desc"
                  },
                  select: {
                    evidence: true
                  }
                }
              }
            }
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

      if (request.payment && request.payment.rail !== input.rail) {
        throw new AtlasPaymentsWorkflowError(
          "Payment retries must use the same rail during the current Phase 4 baseline.",
          "conflict"
        );
      }

      if (request.payment && isAtlasPaymentAttemptLimitReached(request.payment.attempts.length)) {
        throw new AtlasPaymentsWorkflowError(
          `Atlas only allows ${atlasPaymentMaximumAttemptCount} payment attempts per request in the current Phase 4 baseline.`,
          "conflict"
        );
      }

      const scenarioKey = extractScenarioKey(request.metadata);
      const sellerFulfillmentStatus = extractSellerFulfillmentStatus(request.metadata);
      const attemptNumber = (request.payment?.attempts[0]?.attemptNumber ?? 0) + 1;
      const execution =
        input.rail === "STRIPE"
          ? await executeStripeRail({
              requestId: request.id,
              organizationId: request.organizationId,
              sellerOrganizationId: request.sellerOrganizationId,
              amountMinor: request.amountMinor,
              currency: request.currency,
              attemptNumber
            })
          : await executeInternalSimulatedRail({
              requestId: request.id,
              requestStatus: request.status,
              scenarioKey,
              serviceCategory: request.serviceCategory,
              amountMinor: request.amountMinor,
              currency: request.currency,
              attemptNumber
            });
      const provider = execution.provider;

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
              createdByUserId: actor.user.id,
              createdViaRail: input.rail
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
          status: execution.normalizedStatus,
          reference: execution.reference,
          evidence: asInputJsonValue({
            ...execution.evidence,
            scenarioKey,
            providerStatus: execution.providerStatus,
            requestStatusBeforeExecution: request.status
          }),
          errorCode: execution.errorCode,
          errorMessage: execution.errorMessage
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
          reference: execution.reference,
          providerStatus: execution.providerStatus
        }
      });

      const nextRequestStatus =
        execution.normalizedStatus === "FAILED" || execution.normalizedStatus === "VOIDED"
          ? "FAILED"
          : execution.normalizedStatus === "CAPTURED" && sellerFulfillmentStatus === "DELIVERED"
            ? "COMPLETED"
            : execution.normalizedStatus === "CAPTURED" && sellerFulfillmentStatus === "FAILED"
              ? "FAILED"
              : "EXECUTING";
      const nextReceiptStatus = resolveAtlasReceiptStatus({
        paymentStatus: execution.normalizedStatus,
        sellerFulfillmentStatus
      });
      const receiptStorageKey = `receipts/${request.id}.json`;
      const paymentMetadata = {
        ...((asJsonObject(payment.metadata) ?? {}) as Prisma.InputJsonObject),
        scenarioKey,
        latestAttemptNumber: attemptNumber,
        latestReference: execution.reference,
        latestOutcome: execution.normalizedStatus,
        latestProviderStatus: execution.providerStatus,
        latestEvidence: asInputJsonValue(execution.evidence)
      } satisfies Prisma.InputJsonObject;
      const receiptMetadata = {
        scenarioKey,
        rail: input.rail,
        paymentReference: execution.reference,
        paymentStatus: execution.normalizedStatus,
        providerStatus: execution.providerStatus,
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
          reference: execution.reference,
          status: execution.normalizedStatus,
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
          execution.normalizedStatus === "FAILED"
            ? "payment.failed"
            : execution.normalizedStatus === "AUTHORIZED"
              ? "payment.authorized"
              : execution.normalizedStatus === "PENDING"
                ? "payment.pending"
                : "payment.captured",
        payload: {
          rail: input.rail,
          attemptNumber,
          reference: execution.reference,
          outcome: execution.normalizedStatus,
          providerStatus: execution.providerStatus
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
          request: {
            select: {
              status: true,
              metadata: true,
              receipt: {
                select: {
                  status: true
                }
              }
            }
          },
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
