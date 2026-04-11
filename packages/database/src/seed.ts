import { PrismaClient } from "./generated/client/index.js";

const prisma = new PrismaClient();

async function main() {
  const buyerOrganization = await prisma.organization.upsert({
    where: { slug: "atlas-demo-buyer" },
    update: {},
    create: {
      slug: "atlas-demo-buyer",
      name: "Atlas Demo Buyer",
      kind: "BUYER"
    }
  });

  const sellerOrganization = await prisma.organization.upsert({
    where: { slug: "atlas-demo-seller" },
    update: {},
    create: {
      slug: "atlas-demo-seller",
      name: "Atlas Demo Seller",
      kind: "SELLER"
    }
  });

  const operatorOrganization = await prisma.organization.upsert({
    where: { slug: "atlas-demo-operator" },
    update: {},
    create: {
      slug: "atlas-demo-operator",
      name: "Atlas Demo Operator",
      kind: "OPERATOR"
    }
  });

  const ownerUser = await prisma.user.upsert({
    where: { email: "owner@atlas.local" },
    update: {},
    create: {
      email: "owner@atlas.local",
      name: "Atlas Owner"
    }
  });

  const operatorUser = await prisma.user.upsert({
    where: { email: "operator@atlas.local" },
    update: {},
    create: {
      email: "operator@atlas.local",
      name: "Atlas Operator"
    }
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId_role: {
        userId: ownerUser.id,
        organizationId: buyerOrganization.id,
        role: "OWNER"
      }
    },
    update: {},
    create: {
      userId: ownerUser.id,
      organizationId: buyerOrganization.id,
      role: "OWNER"
    }
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId_role: {
        userId: operatorUser.id,
        organizationId: operatorOrganization.id,
        role: "OPERATOR"
      }
    },
    update: {},
    create: {
      userId: operatorUser.id,
      organizationId: operatorOrganization.id,
      role: "OPERATOR"
    }
  });

  const policy = await prisma.policy.upsert({
    where: {
      id: "phase-0-demo-policy"
    },
    update: {},
    create: {
      id: "phase-0-demo-policy",
      organizationId: buyerOrganization.id,
      name: "Phase 0 Demo Policy",
      status: "ACTIVE",
      rules: {
        serviceCategories: ["api-access", "digital-service"],
        approvalThresholdMinor: 50000
      }
    }
  });

  const agent = await prisma.agent.upsert({
    where: {
      id: "phase-0-demo-agent"
    },
    update: {},
    create: {
      id: "phase-0-demo-agent",
      organizationId: buyerOrganization.id,
      name: "Demo Procurement Agent",
      externalRef: "agent://atlas/demo-procurement",
      status: "ACTIVE",
      policyId: policy.id
    }
  });

  const request = await prisma.spendRequest.upsert({
    where: {
      id: "phase-0-demo-request"
    },
    update: {},
    create: {
      id: "phase-0-demo-request",
      organizationId: buyerOrganization.id,
      agentId: agent.id,
      policyId: policy.id,
      sellerOrganizationId: sellerOrganization.id,
      title: "Demo paid API access",
      amountMinor: 1900,
      currency: "USD",
      serviceCategory: "api-access",
      status: "APPROVED",
      requestPayload: {
        service: "seller-demo-api",
        plan: "team"
      }
    }
  });

  await prisma.approval.upsert({
    where: {
      requestId: request.id
    },
    update: {},
    create: {
      requestId: request.id,
      approverId: ownerUser.id,
      status: "APPROVED",
      decisionReason: "Foundation demo seed"
    }
  });

  await prisma.payment.upsert({
    where: {
      requestId: request.id
    },
    update: {},
    create: {
      requestId: request.id,
      organizationId: buyerOrganization.id,
      sellerOrganizationId: sellerOrganization.id,
      provider: "placeholder",
      reference: "demo-payment-001",
      status: "CAPTURED",
      amountMinor: 1900,
      currency: "USD"
    }
  });

  await prisma.receipt.upsert({
    where: {
      requestId: request.id
    },
    update: {},
    create: {
      requestId: request.id,
      organizationId: buyerOrganization.id,
      storageKey: "receipts/phase-0-demo-request.json",
      contentType: "application/json",
      status: "AVAILABLE",
      metadata: {
        source: "seed"
      }
    }
  });

  await prisma.auditEvent.upsert({
    where: {
      id: "phase-0-demo-audit"
    },
    update: {},
    create: {
      id: "phase-0-demo-audit",
      organizationId: buyerOrganization.id,
      userId: ownerUser.id,
      agentId: agent.id,
      requestId: request.id,
      actorType: "HUMAN",
      eventType: "seed.phase-0.initialized",
      targetType: "SpendRequest",
      targetId: request.id,
      payload: {
        operatorOrganizationId: operatorOrganization.id
      }
    }
  });
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
