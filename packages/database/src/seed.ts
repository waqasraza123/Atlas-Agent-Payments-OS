import { Prisma, PrismaClient } from "./generated/client/index.js";
import {
  atlasSeedAgents,
  atlasSeedApprovals,
  atlasSeedAuditEvents,
  atlasSeedMemberships,
  atlasSeedPaymentAttempts,
  atlasSeedOrganizations,
  atlasSeedPayments,
  atlasSeedPolicies,
  atlasSeedReceipts,
  atlasSeedServices,
  atlasSeedSpendRequests,
  atlasSeedUsers,
  createAtlasSeedManifest
} from "./seed-data.js";

const prisma = new PrismaClient();

async function ensureOrganizations() {
  for (const organization of atlasSeedOrganizations) {
    await prisma.organization.upsert({
      where: {
        slug: organization.slug
      },
      update: {
        name: organization.name,
        kind: organization.kind
      },
      create: {
        slug: organization.slug,
        name: organization.name,
        kind: organization.kind
      }
    });
  }
}

async function ensureUsers() {
  for (const user of atlasSeedUsers) {
    await prisma.user.upsert({
      where: {
        email: user.email
      },
      update: {
        name: user.name
      },
      create: {
        email: user.email,
        name: user.name
      }
    });
  }
}

async function createLookupMaps() {
  const [organizations, users] = await Promise.all([
    prisma.organization.findMany({
      where: {
        slug: {
          in: atlasSeedOrganizations.map((organization) => organization.slug)
        }
      }
    }),
    prisma.user.findMany({
      where: {
        email: {
          in: atlasSeedUsers.map((user) => user.email)
        }
      }
    })
  ]);

  return {
    organizationIdsBySlug: new Map(organizations.map((organization) => [organization.slug, organization.id])),
    userIdsByEmail: new Map(users.map((user) => [user.email, user.id]))
  };
}

async function ensureMemberships(args: {
  organizationIdsBySlug: Map<string, string>;
  userIdsByEmail: Map<string, string>;
}) {
  for (const membership of atlasSeedMemberships) {
    const organizationId = args.organizationIdsBySlug.get(membership.organizationSlug);
    const userId = args.userIdsByEmail.get(membership.userEmail);

    if (!organizationId || !userId) {
      throw new Error(`Missing lookup for membership ${membership.userEmail} -> ${membership.organizationSlug}`);
    }

    await prisma.membership.upsert({
      where: {
        userId_organizationId_role: {
          userId,
          organizationId,
          role: membership.role
        }
      },
      update: {},
      create: {
        userId,
        organizationId,
        role: membership.role
      }
    });
  }
}

async function ensurePolicies(organizationIdsBySlug: Map<string, string>) {
  for (const policy of atlasSeedPolicies) {
    const organizationId = organizationIdsBySlug.get(policy.organizationSlug);

    if (!organizationId) {
      throw new Error(`Missing organization for policy ${policy.id}`);
    }

    await prisma.policy.upsert({
      where: {
        id: policy.id
      },
      update: {
        organizationId,
        name: policy.name,
        status: policy.status,
        version: policy.version,
        rules: policy.rules
      },
      create: {
        id: policy.id,
        organizationId,
        name: policy.name,
        status: policy.status,
        version: policy.version,
        rules: policy.rules
      }
    });
  }
}

async function ensureAgents(organizationIdsBySlug: Map<string, string>) {
  for (const agent of atlasSeedAgents) {
    const organizationId = organizationIdsBySlug.get(agent.organizationSlug);

    if (!organizationId) {
      throw new Error(`Missing organization for agent ${agent.id}`);
    }

    await prisma.agent.upsert({
      where: {
        id: agent.id
      },
      update: {
        organizationId,
        name: agent.name,
        externalRef: agent.externalRef,
        status: agent.status,
        policyId: agent.policyId,
        metadata: agent.metadata
      },
      create: {
        id: agent.id,
        organizationId,
        name: agent.name,
        externalRef: agent.externalRef,
        status: agent.status,
        policyId: agent.policyId,
        metadata: agent.metadata
      }
    });
  }
}

async function ensureSpendRequests(organizationIdsBySlug: Map<string, string>) {
  for (const request of atlasSeedSpendRequests) {
    const organizationId = organizationIdsBySlug.get(request.organizationSlug);
    const sellerOrganizationId = request.sellerOrganizationSlug
      ? organizationIdsBySlug.get(request.sellerOrganizationSlug) ?? null
      : null;

    if (!organizationId) {
      throw new Error(`Missing buyer organization for request ${request.id}`);
    }

    await prisma.spendRequest.upsert({
      where: {
        id: request.id
      },
      update: {
        organizationId,
        agentId: request.agentId,
        policyId: request.policyId,
        sellerOrganizationId,
        serviceKey: request.serviceKey,
        idempotencyKey: request.idempotencyKey,
        title: request.title,
        purpose: request.purpose,
        amountMinor: request.amountMinor,
        currency: request.currency,
        serviceCategory: request.serviceCategory,
        status: request.status,
        evaluationResult: request.evaluationResult ?? Prisma.JsonNull,
        requestPayload: request.requestPayload,
        metadata: request.metadata
      },
      create: {
        id: request.id,
        organizationId,
        agentId: request.agentId,
        policyId: request.policyId,
        sellerOrganizationId,
        serviceKey: request.serviceKey,
        idempotencyKey: request.idempotencyKey,
        title: request.title,
        purpose: request.purpose,
        amountMinor: request.amountMinor,
        currency: request.currency,
        serviceCategory: request.serviceCategory,
        status: request.status,
        evaluationResult: request.evaluationResult ?? Prisma.JsonNull,
        requestPayload: request.requestPayload,
        metadata: request.metadata
      }
    });
  }
}

async function ensureServices(organizationIdsBySlug: Map<string, string>) {
  for (const service of atlasSeedServices) {
    const organizationId = organizationIdsBySlug.get(service.organizationSlug);

    if (!organizationId) {
      throw new Error(`Missing seller organization for service ${service.id}`);
    }

    await prisma.service.upsert({
      where: {
        id: service.id
      },
      update: {
        organizationId,
        key: service.key,
        name: service.name,
        description: service.description,
        category: service.category,
        status: service.status,
        visibility: service.visibility,
        pricingModel: service.pricingModel,
        priceMinor: service.priceMinor,
        currency: service.currency,
        metadata: service.metadata ?? Prisma.JsonNull
      },
      create: {
        id: service.id,
        organizationId,
        key: service.key,
        name: service.name,
        description: service.description,
        category: service.category,
        status: service.status,
        visibility: service.visibility,
        pricingModel: service.pricingModel,
        priceMinor: service.priceMinor,
        currency: service.currency,
        metadata: service.metadata ?? Prisma.JsonNull
      }
    });
  }
}

async function ensureApprovals(userIdsByEmail: Map<string, string>) {
  for (const approval of atlasSeedApprovals) {
    const approverId = approval.approverEmail ? userIdsByEmail.get(approval.approverEmail) ?? null : null;

    await prisma.approval.upsert({
      where: {
        requestId: approval.requestId
      },
      update: {
        approverId,
        status: approval.status,
        decisionReason: approval.decisionReason
      },
      create: {
        requestId: approval.requestId,
        approverId,
        status: approval.status,
        decisionReason: approval.decisionReason
      }
    });
  }
}

async function ensurePayments(organizationIdsBySlug: Map<string, string>) {
  for (const payment of atlasSeedPayments) {
    const organizationId = organizationIdsBySlug.get(payment.organizationSlug);
    const sellerOrganizationId = payment.sellerOrganizationSlug
      ? organizationIdsBySlug.get(payment.sellerOrganizationSlug) ?? null
      : null;

    if (!organizationId) {
      throw new Error(`Missing buyer organization for payment ${payment.requestId}`);
    }

    await prisma.payment.upsert({
      where: {
        requestId: payment.requestId
      },
      update: {
        organizationId,
        sellerOrganizationId,
        rail: payment.rail,
        provider: payment.provider,
        reference: payment.reference,
        status: payment.status,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        metadata: payment.metadata
      },
      create: {
        requestId: payment.requestId,
        organizationId,
        sellerOrganizationId,
        rail: payment.rail,
        provider: payment.provider,
        reference: payment.reference,
        status: payment.status,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        metadata: payment.metadata
      }
    });
  }
}

async function ensurePaymentAttempts() {
  const payments = await prisma.payment.findMany({
    select: {
      id: true,
      requestId: true
    }
  });
  const paymentIdsByRequestId = new Map(payments.map((payment) => [payment.requestId, payment.id]));

  for (const attempt of atlasSeedPaymentAttempts) {
    const paymentId = paymentIdsByRequestId.get(attempt.requestId);

    if (!paymentId) {
      throw new Error(`Missing payment for payment attempt ${attempt.requestId}#${attempt.attemptNumber}`);
    }

    await prisma.paymentAttempt.upsert({
      where: {
        paymentId_attemptNumber: {
          paymentId,
          attemptNumber: attempt.attemptNumber
        }
      },
      update: {
        rail: attempt.rail,
        status: attempt.status,
        reference: attempt.reference,
        evidence: attempt.evidence ?? Prisma.JsonNull,
        errorCode: attempt.errorCode,
        errorMessage: attempt.errorMessage
      },
      create: {
        paymentId,
        attemptNumber: attempt.attemptNumber,
        rail: attempt.rail,
        status: attempt.status,
        reference: attempt.reference,
        evidence: attempt.evidence ?? Prisma.JsonNull,
        errorCode: attempt.errorCode,
        errorMessage: attempt.errorMessage
      }
    });
  }
}

async function ensureReceipts(organizationIdsBySlug: Map<string, string>) {
  for (const receipt of atlasSeedReceipts) {
    const organizationId = organizationIdsBySlug.get(receipt.organizationSlug);

    if (!organizationId) {
      throw new Error(`Missing organization for receipt ${receipt.requestId}`);
    }

    await prisma.receipt.upsert({
      where: {
        requestId: receipt.requestId
      },
      update: {
        organizationId,
        storageKey: receipt.storageKey,
        contentType: receipt.contentType,
        status: receipt.status,
        metadata: receipt.metadata
      },
      create: {
        requestId: receipt.requestId,
        organizationId,
        storageKey: receipt.storageKey,
        contentType: receipt.contentType,
        status: receipt.status,
        metadata: receipt.metadata
      }
    });
  }
}

async function ensureAuditEvents(args: {
  organizationIdsBySlug: Map<string, string>;
  userIdsByEmail: Map<string, string>;
}) {
  for (const auditEvent of atlasSeedAuditEvents) {
    const organizationId = auditEvent.organizationSlug
      ? args.organizationIdsBySlug.get(auditEvent.organizationSlug) ?? null
      : null;
    const userId = auditEvent.userEmail ? args.userIdsByEmail.get(auditEvent.userEmail) ?? null : null;

    await prisma.auditEvent.upsert({
      where: {
        id: auditEvent.id
      },
      update: {
        organizationId,
        userId,
        agentId: auditEvent.agentId,
        requestId: auditEvent.requestId,
        actorType: auditEvent.actorType,
        eventType: auditEvent.eventType,
        targetType: auditEvent.targetType,
        targetId: auditEvent.targetId,
        payload: auditEvent.payload,
        occurredAt: new Date(auditEvent.occurredAt)
      },
      create: {
        id: auditEvent.id,
        organizationId,
        userId,
        agentId: auditEvent.agentId,
        requestId: auditEvent.requestId,
        actorType: auditEvent.actorType,
        eventType: auditEvent.eventType,
        targetType: auditEvent.targetType,
        targetId: auditEvent.targetId,
        payload: auditEvent.payload,
        occurredAt: new Date(auditEvent.occurredAt)
      }
    });
  }
}

async function main() {
  await ensureOrganizations();
  await ensureUsers();
  const lookups = await createLookupMaps();

  await ensureMemberships(lookups);
  await ensurePolicies(lookups.organizationIdsBySlug);
  await ensureAgents(lookups.organizationIdsBySlug);
  await ensureServices(lookups.organizationIdsBySlug);
  await ensureSpendRequests(lookups.organizationIdsBySlug);
  await ensureApprovals(lookups.userIdsByEmail);
  await ensurePayments(lookups.organizationIdsBySlug);
  await ensurePaymentAttempts();
  await ensureReceipts(lookups.organizationIdsBySlug);
  await ensureAuditEvents(lookups);

  console.log(JSON.stringify(createAtlasSeedManifest(), null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
