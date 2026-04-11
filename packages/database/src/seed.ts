import { atlasLocalSessionProfileList } from "@atlas/auth";
import { PrismaClient } from "./generated/client/index.js";

const prisma = new PrismaClient();

async function ensureOrganizations() {
  const organizations = await Promise.all([
    prisma.organization.upsert({
      where: { slug: "atlas-demo-buyer" },
      update: {},
      create: {
        slug: "atlas-demo-buyer",
        name: "Atlas Demo Buyer",
        kind: "BUYER"
      }
    }),
    prisma.organization.upsert({
      where: { slug: "atlas-demo-seller" },
      update: {},
      create: {
        slug: "atlas-demo-seller",
        name: "Atlas Demo Seller",
        kind: "SELLER"
      }
    }),
    prisma.organization.upsert({
      where: { slug: "atlas-demo-operator" },
      update: {},
      create: {
        slug: "atlas-demo-operator",
        name: "Atlas Demo Operator",
        kind: "OPERATOR"
      }
    })
  ]);

  return {
    buyerOrganization: organizations[0],
    sellerOrganization: organizations[1],
    operatorOrganization: organizations[2]
  };
}

async function ensureUsersAndMemberships() {
  const organizations = await prisma.organization.findMany({
    where: {
      slug: {
        in: atlasLocalSessionProfileList.map((profile) => profile.organizationSlug)
      }
    }
  });

  const organizationBySlug = new Map(organizations.map((organization) => [organization.slug, organization]));

  for (const profile of atlasLocalSessionProfileList) {
    const user = await prisma.user.upsert({
      where: { email: profile.userEmail },
      update: {
        name: profile.label
      },
      create: {
        email: profile.userEmail,
        name: profile.label
      }
    });

    const organization = organizationBySlug.get(profile.organizationSlug);

    if (!organization) {
      throw new Error(`Missing organization for session profile ${profile.key}`);
    }

    await prisma.membership.upsert({
      where: {
        userId_organizationId_role: {
          userId: user.id,
          organizationId: organization.id,
          role: profile.role
        }
      },
      update: {},
      create: {
        userId: user.id,
        organizationId: organization.id,
        role: profile.role
      }
    });
  }
}

async function ensurePoliciesAndAgents(buyerOrganizationId: string) {
  const primaryPolicy = await prisma.policy.upsert({
    where: {
      id: "phase-0-demo-policy"
    },
    update: {},
    create: {
      id: "phase-0-demo-policy",
      organizationId: buyerOrganizationId,
      name: "Phase 0 Demo Policy",
      status: "ACTIVE",
      rules: {
        serviceCategories: ["api-access", "digital-service"],
        approvalThresholdMinor: 50000
      }
    }
  });

  const secondaryPolicy = await prisma.policy.upsert({
    where: {
      id: "phase-0-finance-policy"
    },
    update: {},
    create: {
      id: "phase-0-finance-policy",
      organizationId: buyerOrganizationId,
      name: "Finance Review Policy",
      status: "ACTIVE",
      rules: {
        serviceCategories: ["api-access"],
        approvalThresholdMinor: 100000
      }
    }
  });

  const primaryAgent = await prisma.agent.upsert({
    where: {
      id: "phase-0-demo-agent"
    },
    update: {},
    create: {
      id: "phase-0-demo-agent",
      organizationId: buyerOrganizationId,
      name: "Demo Procurement Agent",
      externalRef: "agent://atlas/demo-procurement",
      status: "ACTIVE",
      policyId: primaryPolicy.id
    }
  });

  await prisma.agent.upsert({
    where: {
      id: "phase-0-review-agent"
    },
    update: {},
    create: {
      id: "phase-0-review-agent",
      organizationId: buyerOrganizationId,
      name: "Finance Review Agent",
      externalRef: "agent://atlas/demo-finance",
      status: "PAUSED",
      policyId: secondaryPolicy.id
    }
  });

  return {
    primaryPolicy,
    primaryAgent
  };
}

async function ensureLifecycleData(args: {
  buyerOrganizationId: string;
  sellerOrganizationId: string;
  operatorOrganizationId: string;
  ownerUserId: string;
  financeUserId: string;
  agentId: string;
  policyId: string;
}) {
  const approvedRequest = await prisma.spendRequest.upsert({
    where: {
      id: "phase-0-demo-request"
    },
    update: {},
    create: {
      id: "phase-0-demo-request",
      organizationId: args.buyerOrganizationId,
      agentId: args.agentId,
      policyId: args.policyId,
      sellerOrganizationId: args.sellerOrganizationId,
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

  const pendingRequest = await prisma.spendRequest.upsert({
    where: {
      id: "phase-0-pending-request"
    },
    update: {},
    create: {
      id: "phase-0-pending-request",
      organizationId: args.buyerOrganizationId,
      agentId: args.agentId,
      policyId: args.policyId,
      sellerOrganizationId: args.sellerOrganizationId,
      title: "Premium dataset unlock",
      amountMinor: 8900,
      currency: "USD",
      serviceCategory: "digital-service",
      status: "SUBMITTED",
      requestPayload: {
        service: "seller-dataset-access",
        dataset: "global-procurement"
      }
    }
  });

  const failedRequest = await prisma.spendRequest.upsert({
    where: {
      id: "phase-0-failed-request"
    },
    update: {},
    create: {
      id: "phase-0-failed-request",
      organizationId: args.buyerOrganizationId,
      agentId: args.agentId,
      policyId: args.policyId,
      sellerOrganizationId: args.sellerOrganizationId,
      title: "Specialized report generation",
      amountMinor: 4200,
      currency: "USD",
      serviceCategory: "digital-service",
      status: "FAILED",
      requestPayload: {
        service: "seller-report-generator",
        reportType: "vendor-risk"
      }
    }
  });

  await prisma.approval.upsert({
    where: {
      requestId: approvedRequest.id
    },
    update: {},
    create: {
      requestId: approvedRequest.id,
      approverId: args.ownerUserId,
      status: "APPROVED",
      decisionReason: "Foundation demo seed"
    }
  });

  await prisma.approval.upsert({
    where: {
      requestId: pendingRequest.id
    },
    update: {},
    create: {
      requestId: pendingRequest.id,
      approverId: args.financeUserId,
      status: "PENDING"
    }
  });

  await prisma.payment.upsert({
    where: {
      requestId: approvedRequest.id
    },
    update: {},
    create: {
      requestId: approvedRequest.id,
      organizationId: args.buyerOrganizationId,
      sellerOrganizationId: args.sellerOrganizationId,
      provider: "placeholder",
      reference: "demo-payment-001",
      status: "CAPTURED",
      amountMinor: 1900,
      currency: "USD"
    }
  });

  await prisma.payment.upsert({
    where: {
      requestId: failedRequest.id
    },
    update: {},
    create: {
      requestId: failedRequest.id,
      organizationId: args.buyerOrganizationId,
      sellerOrganizationId: args.sellerOrganizationId,
      provider: "placeholder",
      reference: "demo-payment-002",
      status: "FAILED",
      amountMinor: 4200,
      currency: "USD"
    }
  });

  await prisma.receipt.upsert({
    where: {
      requestId: approvedRequest.id
    },
    update: {},
    create: {
      requestId: approvedRequest.id,
      organizationId: args.buyerOrganizationId,
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
      organizationId: args.buyerOrganizationId,
      userId: args.ownerUserId,
      agentId: args.agentId,
      requestId: approvedRequest.id,
      actorType: "HUMAN",
      eventType: "seed.phase-0.initialized",
      targetType: "SpendRequest",
      targetId: approvedRequest.id,
      payload: {
        operatorOrganizationId: args.operatorOrganizationId
      }
    }
  });

  await prisma.auditEvent.upsert({
    where: {
      id: "phase-0-pending-audit"
    },
    update: {},
    create: {
      id: "phase-0-pending-audit",
      organizationId: args.buyerOrganizationId,
      userId: args.financeUserId,
      agentId: args.agentId,
      requestId: pendingRequest.id,
      actorType: "HUMAN",
      eventType: "approval.pending",
      targetType: "SpendRequest",
      targetId: pendingRequest.id,
      payload: {
        status: "PENDING"
      }
    }
  });

  await prisma.auditEvent.upsert({
    where: {
      id: "phase-0-failed-audit"
    },
    update: {},
    create: {
      id: "phase-0-failed-audit",
      organizationId: args.buyerOrganizationId,
      userId: args.ownerUserId,
      agentId: args.agentId,
      requestId: failedRequest.id,
      actorType: "HUMAN",
      eventType: "payment.failed",
      targetType: "SpendRequest",
      targetId: failedRequest.id,
      payload: {
        reason: "seeded payment failure"
      }
    }
  });
}

async function main() {
  const { buyerOrganization, sellerOrganization, operatorOrganization } = await ensureOrganizations();
  await ensureUsersAndMemberships();

  const [ownerUser, financeUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: {
        email: "owner@atlas.local"
      }
    }),
    prisma.user.findUniqueOrThrow({
      where: {
        email: "finance@atlas.local"
      }
    })
  ]);

  const { primaryPolicy, primaryAgent } = await ensurePoliciesAndAgents(buyerOrganization.id);

  await ensureLifecycleData({
    buyerOrganizationId: buyerOrganization.id,
    sellerOrganizationId: sellerOrganization.id,
    operatorOrganizationId: operatorOrganization.id,
    ownerUserId: ownerUser.id,
    financeUserId: financeUser.id,
    agentId: primaryAgent.id,
    policyId: primaryPolicy.id
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
