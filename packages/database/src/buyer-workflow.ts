import type { AtlasActorContext } from "@atlas/auth";
import {
  atlasBuyerAgentCreateSchema,
  atlasBuyerAgentUpdateSchema,
  atlasBuyerApprovalDecisionSchema,
  atlasBuyerPolicyCreateSchema,
  atlasBuyerPolicyRulesSchema,
  atlasBuyerPolicyUpdateSchema,
  atlasBuyerRequestCreateSchema,
  evaluateAtlasBuyerSpendRequest,
  normalizeAtlasBuyerPolicyRules,
  parseAtlasPolicyEvaluationResult,
  type AtlasBuyerAgentCreateInput,
  type AtlasBuyerAgentUpdateInput,
  type AtlasBuyerApprovalDecisionInput,
  type AtlasBuyerPolicyCreateInput,
  type AtlasBuyerPolicyRules,
  type AtlasBuyerPolicyUpdateInput,
  type AtlasBuyerRequestCreateInput
} from "@atlas/domain";
import { ZodError } from "zod";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";

export class AtlasBuyerWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "not_found" | "conflict" | "forbidden"
  ) {
    super(message);
    this.name = "AtlasBuyerWorkflowError";
  }
}

export type AtlasBuyerAgentRecord = {
  id: string;
  name: string;
  externalRef: string | null;
  purpose: string | null;
  status: string;
  policyId: string | null;
  policyName: string | null;
  requestCount: number;
};

export type AtlasBuyerPolicyRecord = {
  id: string;
  name: string;
  status: string;
  version: number;
  rules: AtlasBuyerPolicyRules;
  linkedAgentCount: number;
  requestCount: number;
};

export type AtlasBuyerRequestRecord = {
  id: string;
  agentId: string;
  agentName: string;
  policyId: string | null;
  policyName: string | null;
  sellerOrganizationId: string | null;
  sellerOrganizationName: string | null;
  title: string;
  purpose: string;
  amountMinor: number;
  currency: string;
  serviceCategory: string;
  serviceKey: string | null;
  status: string;
  approvalStatus: string | null;
  evaluationOutcome: string | null;
  createdAt: string;
};

export type AtlasBuyerApprovalRecord = {
  id: string;
  requestId: string;
  requestTitle: string;
  amountMinor: number;
  currency: string;
  serviceCategory: string;
  status: string;
  decisionReason: string | null;
  createdAt: string;
};

function getMetadataPurpose(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const purpose = (metadata as Record<string, unknown>).purpose;
  return typeof purpose === "string" && purpose.trim().length > 0 ? purpose : null;
}

function asJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parsePolicyRules(value: Prisma.JsonValue): AtlasBuyerPolicyRules {
  return normalizeAtlasBuyerPolicyRules(atlasBuyerPolicyRulesSchema.parse(value));
}

function mapAgentRecord(
  agent: {
    id: string;
    name: string;
    externalRef: string | null;
    status: string;
    metadata: Prisma.JsonValue | null;
    policy: { id: string; name: string } | null;
    _count: { requests: number };
  }
): AtlasBuyerAgentRecord {
  return {
    id: agent.id,
    name: agent.name,
    externalRef: agent.externalRef,
    purpose: getMetadataPurpose(agent.metadata),
    status: agent.status,
    policyId: agent.policy?.id ?? null,
    policyName: agent.policy?.name ?? null,
    requestCount: agent._count.requests
  };
}

function mapPolicyRecord(
  policy: {
    id: string;
    name: string;
    status: string;
    version: number;
    rules: Prisma.JsonValue;
    _count: { agents: number; requests: number };
  }
): AtlasBuyerPolicyRecord {
  return {
    id: policy.id,
    name: policy.name,
    status: policy.status,
    version: policy.version,
    rules: parsePolicyRules(policy.rules),
    linkedAgentCount: policy._count.agents,
    requestCount: policy._count.requests
  };
}

function mapRequestRecord(
  request: {
    id: string;
    title: string;
    purpose: string;
    amountMinor: number;
    currency: string;
    serviceCategory: string;
    serviceKey: string | null;
    status: string;
    createdAt: Date;
    evaluationResult: Prisma.JsonValue | null;
    agent: { id: string; name: string };
    policy: { id: string; name: string } | null;
    sellerOrganization: { id: string; name: string } | null;
    approval: { status: string | null } | null;
  }
): AtlasBuyerRequestRecord {
  const evaluationResult = parseAtlasPolicyEvaluationResult(request.evaluationResult);
  const evaluationOutcome = evaluationResult?.outcome ?? null;

  return {
    id: request.id,
    agentId: request.agent.id,
    agentName: request.agent.name,
    policyId: request.policy?.id ?? null,
    policyName: request.policy?.name ?? null,
    sellerOrganizationId: request.sellerOrganization?.id ?? null,
    sellerOrganizationName: request.sellerOrganization?.name ?? null,
    title: request.title,
    purpose: request.purpose,
    amountMinor: request.amountMinor,
    currency: request.currency,
    serviceCategory: request.serviceCategory,
    serviceKey: request.serviceKey,
    status: request.status,
    approvalStatus: request.approval?.status ?? null,
    evaluationOutcome,
    createdAt: request.createdAt.toISOString()
  };
}

function mapApprovalRecord(
  approval: {
    id: string;
    status: string;
    decisionReason: string | null;
    createdAt: Date;
    request: {
      id: string;
      title: string;
      amountMinor: number;
      currency: string;
      serviceCategory: string;
    };
  }
): AtlasBuyerApprovalRecord {
  return {
    id: approval.id,
    requestId: approval.request.id,
    requestTitle: approval.request.title,
    amountMinor: approval.request.amountMinor,
    currency: approval.request.currency,
    serviceCategory: approval.request.serviceCategory,
    status: approval.status,
    decisionReason: approval.decisionReason,
    createdAt: approval.createdAt.toISOString()
  };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function normalizeValidationError(error: unknown): never {
  if (error instanceof AtlasBuyerWorkflowError) {
    throw error;
  }

  if (error instanceof ZodError) {
    throw new AtlasBuyerWorkflowError(error.issues.map((issue) => issue.message).join("; "), "bad_request");
  }

  throw error;
}

async function createAuditEvent(
  transaction: Prisma.TransactionClient,
  actor: AtlasActorContext,
  input: {
    requestId?: string | null;
    agentId?: string | null;
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
      agentId: input.agentId ?? actor.agentId ?? null,
      requestId: input.requestId ?? null,
      actorType: "HUMAN",
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId,
      payload: input.payload
    }
  });
}

async function getOrganizationScopedPolicy(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  policyId: string
) {
  const policy = await transaction.policy.findFirst({
    where: {
      id: policyId,
      organizationId
    }
  });

  if (!policy) {
    throw new AtlasBuyerWorkflowError("The selected policy is not available in this buyer organization.", "not_found");
  }

  return policy;
}

export async function listBuyerAgents(organizationId: string, client: PrismaClient | Prisma.TransactionClient = prisma) {
  const agents = await client.agent.findMany({
    where: {
      organizationId
    },
    include: {
      policy: {
        select: {
          id: true,
          name: true
        }
      },
      _count: {
        select: {
          requests: true
        }
      }
    },
    orderBy: [
      {
        status: "asc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  return agents.map(mapAgentRecord);
}

export async function createBuyerAgent(actor: AtlasActorContext, rawInput: unknown) {
  try {
    const input = atlasBuyerAgentCreateSchema.parse(rawInput);

    const policy = input.policyId
      ? await prisma.policy.findFirst({
          where: {
            id: input.policyId,
            organizationId: actor.organization.id
          }
        })
      : null;

    if (input.policyId && !policy) {
      throw new AtlasBuyerWorkflowError("The selected policy is not available in this buyer organization.", "not_found");
    }

    const agent = await prisma.agent.create({
      data: {
        organizationId: actor.organization.id,
        name: input.name,
        externalRef: input.externalRef?.trim() || null,
        status: input.status,
        policyId: input.policyId ?? null,
        metadata: {
          purpose: input.purpose
        }
      },
      include: {
        policy: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            requests: true
          }
        }
      }
    });

    await prisma.auditEvent.create({
      data: {
        organizationId: actor.organization.id,
        userId: actor.user.id,
        agentId: agent.id,
        actorType: "HUMAN",
        eventType: "agent_created",
        targetType: "Agent",
        targetId: agent.id,
        payload: {
          name: agent.name,
          policyId: agent.policyId
        }
      }
    });

    return mapAgentRecord(agent);
  } catch (error) {
    normalizeValidationError(error);
  }
}

export async function updateBuyerAgent(actor: AtlasActorContext, agentId: string, rawInput: unknown) {
  try {
    const input = atlasBuyerAgentUpdateSchema.parse(rawInput);
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        organizationId: actor.organization.id
      }
    });

    if (!agent) {
      throw new AtlasBuyerWorkflowError("The selected agent is not available in this buyer organization.", "not_found");
    }

    if (input.policyId) {
      await getOrganizationScopedPolicy(prisma, actor.organization.id, input.policyId);
    }

    const nextMetadata = {
      ...(asJsonObject(agent.metadata) ?? {}),
      ...(input.purpose ? { purpose: input.purpose } : {})
    } satisfies Prisma.InputJsonValue;

    const updated = await prisma.agent.update({
      where: {
        id: agent.id
      },
      data: {
        name: input.name ?? undefined,
        externalRef: input.externalRef === undefined ? undefined : input.externalRef?.trim() || null,
        status: input.status ?? undefined,
        policyId: input.policyId === undefined ? undefined : input.policyId,
        metadata: nextMetadata
      },
      include: {
        policy: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            requests: true
          }
        }
      }
    });

    await prisma.auditEvent.create({
      data: {
        organizationId: actor.organization.id,
        userId: actor.user.id,
        agentId: updated.id,
        actorType: "HUMAN",
        eventType: "agent_updated",
        targetType: "Agent",
        targetId: updated.id,
        payload: {
          status: updated.status,
          policyId: updated.policyId
        }
      }
    });

    return mapAgentRecord(updated);
  } catch (error) {
    normalizeValidationError(error);
  }
}

export async function listBuyerPolicies(organizationId: string, client: PrismaClient | Prisma.TransactionClient = prisma) {
  const policies = await client.policy.findMany({
    where: {
      organizationId
    },
    include: {
      _count: {
        select: {
          agents: true,
          requests: true
        }
      }
    },
    orderBy: [
      {
        status: "asc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  return policies.map(mapPolicyRecord);
}

export async function createBuyerPolicy(actor: AtlasActorContext, rawInput: unknown) {
  try {
    const input = atlasBuyerPolicyCreateSchema.parse(rawInput);
    const rules = normalizeAtlasBuyerPolicyRules(input.rules);

    const policy = await prisma.policy.create({
      data: {
        organizationId: actor.organization.id,
        name: input.name,
        status: input.status,
        version: 1,
        rules
      },
      include: {
        _count: {
          select: {
            agents: true,
            requests: true
          }
        }
      }
    });

    await prisma.auditEvent.create({
      data: {
        organizationId: actor.organization.id,
        userId: actor.user.id,
        actorType: "HUMAN",
        eventType: "policy_created",
        targetType: "Policy",
        targetId: policy.id,
        payload: {
          name: policy.name,
          version: policy.version
        }
      }
    });

    return mapPolicyRecord(policy);
  } catch (error) {
    normalizeValidationError(error);
  }
}

export async function updateBuyerPolicy(actor: AtlasActorContext, policyId: string, rawInput: unknown) {
  try {
    const input = atlasBuyerPolicyUpdateSchema.parse(rawInput);
    const current = await getOrganizationScopedPolicy(prisma, actor.organization.id, policyId);
    const rules = input.rules ? normalizeAtlasBuyerPolicyRules(input.rules) : undefined;
    const updated = await prisma.policy.update({
      where: {
        id: current.id
      },
      data: {
        name: input.name ?? undefined,
        status: input.status ?? undefined,
        rules: rules ?? undefined,
        version: rules ? current.version + 1 : undefined
      },
      include: {
        _count: {
          select: {
            agents: true,
            requests: true
          }
        }
      }
    });

    await prisma.auditEvent.create({
      data: {
        organizationId: actor.organization.id,
        userId: actor.user.id,
        actorType: "HUMAN",
        eventType: "policy_updated",
        targetType: "Policy",
        targetId: updated.id,
        payload: {
          status: updated.status,
          version: updated.version
        }
      }
    });

    return mapPolicyRecord(updated);
  } catch (error) {
    normalizeValidationError(error);
  }
}

export async function listBuyerRequests(organizationId: string, client: PrismaClient | Prisma.TransactionClient = prisma) {
  const requests = await client.spendRequest.findMany({
    where: {
      organizationId
    },
    include: {
      agent: {
        select: {
          id: true,
          name: true
        }
      },
      policy: {
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
          status: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return requests.map(mapRequestRecord);
}

export async function createBuyerRequest(actor: AtlasActorContext, rawInput: unknown) {
  try {
    const input = atlasBuyerRequestCreateSchema.parse(rawInput);
    const normalizedIdempotencyKey = input.idempotencyKey?.trim() || null;

    return await prisma.$transaction(async (transaction) => {
      if (normalizedIdempotencyKey) {
        const existing = await transaction.spendRequest.findFirst({
          where: {
            organizationId: actor.organization.id,
            idempotencyKey: normalizedIdempotencyKey
          },
          include: {
            agent: {
              select: {
                id: true,
                name: true
              }
            },
            policy: {
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
                status: true
              }
            }
          }
        });

        if (existing) {
          const existingPayload = asJsonObject(existing.requestPayload) ?? {};
          const existingServiceKey = typeof existingPayload.serviceKey === "string" ? existingPayload.serviceKey : null;

          if (
            existing.agentId !== input.agentId ||
            existing.amountMinor !== input.amountMinor ||
            existing.title !== input.title ||
            existing.serviceCategory !== input.serviceCategory ||
            existingServiceKey !== (input.serviceKey ?? null)
          ) {
            throw new AtlasBuyerWorkflowError(
              "The provided idempotency key is already bound to a different spend request payload.",
              "conflict"
            );
          }

          return mapRequestRecord(existing);
        }
      }

      const agent = await transaction.agent.findFirst({
        where: {
          id: input.agentId,
          organizationId: actor.organization.id
        }
      });

      if (!agent) {
        throw new AtlasBuyerWorkflowError("The selected agent is not available in this buyer organization.", "not_found");
      }

      const sellerOrganizationId = input.sellerOrganizationId ?? null;
      if (!sellerOrganizationId) {
        throw new AtlasBuyerWorkflowError("A seller organization is required for buyer spend requests.", "bad_request");
      }

      const sellerOrganization = await transaction.organization.findFirst({
        where: {
          id: sellerOrganizationId,
          kind: "SELLER"
        }
      });

      if (!sellerOrganization) {
        throw new AtlasBuyerWorkflowError("The selected seller organization is not available.", "not_found");
      }

      const resolvedPolicyId = input.policyId ?? agent.policyId;
      if (!resolvedPolicyId) {
        throw new AtlasBuyerWorkflowError(
          "A policy is required before Atlas can evaluate and submit a spend request.",
          "bad_request"
        );
      }

      const policy = await getOrganizationScopedPolicy(transaction, actor.organization.id, resolvedPolicyId);
      if (policy.status !== "ACTIVE") {
        throw new AtlasBuyerWorkflowError("Only active policies can be used for new spend requests.", "bad_request");
      }

      const evaluation = evaluateAtlasBuyerSpendRequest({
        agentStatus: agent.status,
        amountMinor: input.amountMinor,
        sellerOrganizationId,
        serviceCategory: input.serviceCategory,
        serviceKey: input.serviceKey ?? null,
        policyId: policy.id,
        policyVersion: policy.version,
        rules: parsePolicyRules(policy.rules)
      });

      const request = await transaction.spendRequest.create({
        data: {
          organizationId: actor.organization.id,
          agentId: agent.id,
          policyId: policy.id,
          sellerOrganizationId: sellerOrganization.id,
          serviceKey: input.serviceKey ?? null,
          idempotencyKey: normalizedIdempotencyKey,
          title: input.title,
          purpose: input.purpose,
          amountMinor: input.amountMinor,
          currency: input.currency,
          serviceCategory: input.serviceCategory,
          status: evaluation.status,
          evaluationResult: evaluation,
          requestPayload: {
            serviceKey: input.serviceKey ?? null,
            createdByUserId: actor.user.id,
            createdByMembershipId: actor.membership.id
          },
          metadata: {
            source: "buyer-workflow",
            policyVersion: policy.version
          }
        },
        include: {
          agent: {
            select: {
              id: true,
              name: true
            }
          },
          policy: {
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
              status: true
            }
          }
        }
      });

      if (evaluation.approvalStatus === "PENDING") {
        await transaction.approval.create({
          data: {
            requestId: request.id,
            status: "PENDING"
          }
        });
      }

      if (evaluation.approvalStatus === "APPROVED") {
        await transaction.approval.create({
          data: {
            requestId: request.id,
            status: "APPROVED",
            decisionReason: evaluation.reasons[0] ?? "Auto-approved by policy"
          }
        });
      }

      await createAuditEvent(transaction, actor, {
        requestId: request.id,
        agentId: agent.id,
        targetType: "SpendRequest",
        targetId: request.id,
        eventType: "request_created",
        payload: {
          amountMinor: request.amountMinor,
          currency: request.currency,
          sellerOrganizationId
        }
      });

      await createAuditEvent(transaction, actor, {
        requestId: request.id,
        agentId: agent.id,
        targetType: "SpendRequest",
        targetId: request.id,
        eventType: "policy_evaluated",
        payload: evaluation
      });

      await createAuditEvent(transaction, actor, {
        requestId: request.id,
        agentId: agent.id,
        targetType: "SpendRequest",
        targetId: request.id,
        eventType:
          evaluation.outcome === "allow_auto_approved"
            ? "approval_granted"
            : evaluation.outcome === "allow_requires_approval"
              ? "manual_approval_required"
              : "request_rejected",
        payload: {
          outcome: evaluation.outcome,
          reasons: evaluation.reasons
        }
      });

      const refreshed = await transaction.spendRequest.findFirstOrThrow({
        where: {
          id: request.id
        },
        include: {
          agent: {
            select: {
              id: true,
              name: true
            }
          },
          policy: {
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
              status: true
            }
          }
        }
      });

      return mapRequestRecord(refreshed);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AtlasBuyerWorkflowError("The provided idempotency key is already in use.", "conflict");
    }

    normalizeValidationError(error);
  }
}

export async function listBuyerApprovals(organizationId: string, client: PrismaClient | Prisma.TransactionClient = prisma) {
  const approvals = await client.approval.findMany({
    where: {
      request: {
        organizationId
      }
    },
    include: {
      request: {
        select: {
          id: true,
          title: true,
          amountMinor: true,
          currency: true,
          serviceCategory: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return approvals.map(mapApprovalRecord);
}

export async function decideBuyerApproval(actor: AtlasActorContext, approvalId: string, rawInput: unknown) {
  try {
    const input = atlasBuyerApprovalDecisionSchema.parse(rawInput);

    return await prisma.$transaction(async (transaction) => {
      const approval = await transaction.approval.findFirst({
        where: {
          id: approvalId,
          request: {
            organizationId: actor.organization.id
          }
        },
        include: {
          request: {
            include: {
              agent: {
                select: {
                  id: true,
                  name: true
                }
              },
              policy: {
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
              }
            }
          }
        }
      });

      if (!approval) {
        throw new AtlasBuyerWorkflowError("The selected approval is not available in this buyer organization.", "not_found");
      }

      if (approval.status !== "PENDING") {
        throw new AtlasBuyerWorkflowError("Only pending approvals can be decided.", "conflict");
      }

      const nextApprovalStatus = input.decision === "approve" ? "APPROVED" : "REJECTED";
      const nextRequestStatus = input.decision === "approve" ? "APPROVED" : "REJECTED";

      await transaction.approval.update({
        where: {
          id: approval.id
        },
        data: {
          approverId: actor.user.id,
          status: nextApprovalStatus,
          decisionReason: input.decisionReason
        }
      });

      await transaction.spendRequest.update({
        where: {
          id: approval.request.id
        },
        data: {
          status: nextRequestStatus
        }
      });

      await createAuditEvent(transaction, actor, {
        requestId: approval.request.id,
        agentId: approval.request.agent.id,
        targetType: "Approval",
        targetId: approval.id,
        eventType: input.decision === "approve" ? "approval_granted" : "approval_denied",
        payload: {
          decisionReason: input.decisionReason
        }
      });

      const refreshed = await transaction.approval.findFirstOrThrow({
        where: {
          id: approval.id
        },
        include: {
          request: {
            select: {
              id: true,
              title: true,
              amountMinor: true,
              currency: true,
              serviceCategory: true
            }
          }
        }
      });

      return mapApprovalRecord(refreshed);
    });
  } catch (error) {
    normalizeValidationError(error);
  }
}

export async function getBuyerApprovalRoleGuard(actor: AtlasActorContext) {
  const allowedRoles = new Set(["OWNER", "ADMIN", "REVIEWER", "FINANCE"]);

  if (!allowedRoles.has(actor.membership.role)) {
    throw new AtlasBuyerWorkflowError("The current role is not allowed to decide approvals.", "forbidden");
  }
}
