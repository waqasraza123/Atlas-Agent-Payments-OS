import "reflect-metadata";
import type { AtlasActorContext } from "@atlas/auth";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { ActorResolutionService } from "../src/modules/actor/actor.service";
import { AtlasBuyerWorkflowError } from "@atlas/database";

const databaseMock = vi.hoisted(() => ({
  listBuyerAgents: vi.fn(async () => []),
  createBuyerAgent: vi.fn(async (_actor: unknown, input: Record<string, unknown>) => ({
    id: "agent-created",
    name: String(input.name ?? "Created Agent"),
    externalRef: null,
    purpose: String(input.purpose ?? ""),
    status: String(input.status ?? "DRAFT"),
    policyId: null,
    policyName: null,
    requestCount: 0
  })),
  updateBuyerAgent: vi.fn(async () => ({
    id: "agent-updated",
    name: "Updated Agent",
    externalRef: null,
    purpose: "Updated purpose",
    status: "ACTIVE",
    policyId: null,
    policyName: null,
    requestCount: 1
  })),
  listBuyerPolicies: vi.fn(async () => []),
  createBuyerPolicy: vi.fn(async () => ({
    id: "policy-created",
    name: "Created Policy",
    status: "ACTIVE",
    version: 1,
    rules: {
      maxAmountMinor: 5000,
      autoApprovalThresholdMinor: 2500,
      escalationThresholdMinor: null,
      sellerAllowlist: [],
      serviceAllowlist: [],
      serviceCategories: ["api-access"],
      emergencyStop: false
    },
    linkedAgentCount: 0,
    requestCount: 0
  })),
  updateBuyerPolicy: vi.fn(async () => ({
    id: "policy-updated",
    name: "Updated Policy",
    status: "ACTIVE",
    version: 2,
    rules: {
      maxAmountMinor: 5000,
      autoApprovalThresholdMinor: 2500,
      escalationThresholdMinor: null,
      sellerAllowlist: [],
      serviceAllowlist: [],
      serviceCategories: ["api-access"],
      emergencyStop: false
    },
    linkedAgentCount: 1,
    requestCount: 1
  })),
  listBuyerRequests: vi.fn(async () => []),
  createBuyerRequest: vi.fn(async () => ({
    id: "request-created",
    agentId: "agent-1",
    agentName: "Procurement Agent",
    policyId: "policy-1",
    policyName: "Low Risk API Access",
    sellerOrganizationId: "seller-1",
    sellerOrganizationName: "Atlas Demo Seller",
    title: "Created Request",
    purpose: "Submit a paid request for a production buyer workflow test.",
    amountMinor: 2400,
    currency: "USD",
    serviceCategory: "api-access",
    status: "SUBMITTED",
    approvalStatus: "PENDING",
    evaluationOutcome: "allow_requires_approval",
    createdAt: new Date().toISOString()
  })),
  listBuyerApprovals: vi.fn(async () => []),
  decideBuyerApproval: vi.fn(async () => ({
    id: "approval-1",
    requestId: "request-created",
    requestTitle: "Created Request",
    amountMinor: 2400,
    currency: "USD",
    serviceCategory: "api-access",
    status: "APPROVED",
    decisionReason: "Within delegated approval threshold",
    createdAt: new Date().toISOString()
  })),
  getBuyerApprovalRoleGuard: vi.fn(async () => undefined)
}));

vi.mock("@atlas/database", async () => {
  const actual = await vi.importActual<typeof import("@atlas/database")>("@atlas/database");

  return {
    ...actual,
    listBuyerAgents: databaseMock.listBuyerAgents,
    createBuyerAgent: databaseMock.createBuyerAgent,
    updateBuyerAgent: databaseMock.updateBuyerAgent,
    listBuyerPolicies: databaseMock.listBuyerPolicies,
    createBuyerPolicy: databaseMock.createBuyerPolicy,
    updateBuyerPolicy: databaseMock.updateBuyerPolicy,
    listBuyerRequests: databaseMock.listBuyerRequests,
    createBuyerRequest: databaseMock.createBuyerRequest,
    listBuyerApprovals: databaseMock.listBuyerApprovals,
    decideBuyerApproval: databaseMock.decideBuyerApproval,
    getBuyerApprovalRoleGuard: databaseMock.getBuyerApprovalRoleGuard
  };
});

function createActor(workspace: AtlasActorContext["workspace"], role: AtlasActorContext["membership"]["role"]): AtlasActorContext {
  return {
    user: {
      id: `user-${workspace.toLowerCase()}`,
      email: `${workspace.toLowerCase()}@atlas.local`,
      name: `${workspace} Tester`
    },
    organization: {
      id: `org-${workspace.toLowerCase()}`,
      slug: `atlas-${workspace.toLowerCase()}`,
      name: `${workspace} Organization`,
      kind: workspace
    },
    membership: {
      id: `membership-${workspace.toLowerCase()}`,
      role
    },
    workspace,
    agentId: null,
    source: "local-development"
  };
}

describe("atlas api e2e", () => {
  let app: INestApplication;
  const actorResolutionServiceMock = {
    readSessionHeader: vi.fn((headers: Record<string, string | string[] | undefined>) => headers["x-atlas-local-session"]),
    resolveFromHeader: vi.fn(async () => ({
      status: "missing" as const,
      message: "Missing local actor session header"
    }))
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(ActorResolutionService)
      .useValue(actorResolutionServiceMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    actorResolutionServiceMock.readSessionHeader.mockClear();
    actorResolutionServiceMock.resolveFromHeader.mockReset();
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "missing",
      message: "Missing local actor session header"
    });
    for (const mockFn of Object.values(databaseMock)) {
      mockFn.mockClear();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves health without actor context", async () => {
    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("lists the registered module map", async () => {
    const response = await request(app.getHttpServer()).get("/platform/modules");

    expect(response.status).toBe(200);
    expect(response.body.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module: expect.objectContaining({
            key: "identity"
          })
        }),
        expect.objectContaining({
          module: expect.objectContaining({
            key: "payments"
          })
        })
      ])
    );
  });

  it("lists the registered queue map", async () => {
    const response = await request(app.getHttpServer()).get("/platform/queues");

    expect(response.status).toBe(200);
    expect(response.body.queues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queue: expect.objectContaining({
            key: "approvals-routing",
            family: "approvals"
          })
        }),
        expect.objectContaining({
          queue: expect.objectContaining({
            key: "payments-execution",
            family: "payments"
          })
        })
      ])
    );
  });

  it("returns unauthorized when a protected route has no actor header", async () => {
    const response = await request(app.getHttpServer()).get("/identity/session");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Missing local actor session header");
  });

  it("returns service unavailable when actor resolution is not available", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "unavailable",
      message: "Database is unavailable"
    });

    const response = await request(app.getHttpServer())
      .get("/identity/session")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(503);
    expect(response.body.message).toBe("Database is unavailable");
  });

  it("enforces workspace boundaries for buyer-only modules", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "seller-admin",
        workspace: "SELLER",
        userEmail: "seller@atlas.local",
        organizationSlug: "atlas-demo-seller",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("SELLER", "ADMIN")
    });

    const response = await request(app.getHttpServer())
      .get("/agents/summary")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Actor does not have access to this workspace");
  });

  it("allows shared modules for supported workspaces", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "seller-admin",
        workspace: "SELLER",
        userEmail: "seller@atlas.local",
        organizationSlug: "atlas-demo-seller",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("SELLER", "ADMIN")
    });

    const response = await request(app.getHttpServer())
      .get("/payments/summary")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(200);
    expect(response.body.module).toMatchObject({
      key: "payments",
      workspace: "SELLER"
    });
  });

  it("lists buyer agents through the protected buyer module", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.listBuyerAgents.mockResolvedValueOnce([
      {
        id: "agent-1",
        name: "Procurement Agent",
        externalRef: "agent://atlas/procurement",
        purpose: "Handle bounded procurement API access.",
        status: "ACTIVE",
        policyId: "policy-1",
        policyName: "Low Risk API Access",
        requestCount: 3
      }
    ]);

    const response = await request(app.getHttpServer())
      .get("/agents")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      expect.objectContaining({
        id: "agent-1",
        status: "ACTIVE"
      })
    ]);
  });

  it("creates buyer requests through the protected buyer module", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });

    const response = await request(app.getHttpServer())
      .post("/requests")
      .set("x-atlas-local-session", "local-token")
      .send({
        agentId: "agent-1",
        sellerOrganizationId: "seller-1",
        title: "Created Request",
        purpose: "Submit a paid request for a production buyer workflow test.",
        amountMinor: 2400,
        currency: "USD",
        serviceCategory: "api-access",
        serviceKey: "benchmark-api"
      });

    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({
      id: "request-created",
      approvalStatus: "PENDING"
    });
    expect(databaseMock.createBuyerRequest).toHaveBeenCalledTimes(1);
  });

  it("records approval decisions through the protected buyer module", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-finance",
        workspace: "BUYER",
        userEmail: "finance@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "FINANCE",
        agentId: null
      },
      actor: createActor("BUYER", "FINANCE")
    });

    const response = await request(app.getHttpServer())
      .post("/approvals/approval-1/decision")
      .set("x-atlas-local-session", "local-token")
      .send({
        decision: "approve",
        decisionReason: "Within delegated approval threshold"
      });

    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({
      id: "approval-1",
      status: "APPROVED"
    });
  });

  it("maps buyer workflow conflicts to http conflict responses", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.createBuyerRequest.mockRejectedValueOnce(
      new AtlasBuyerWorkflowError("The provided idempotency key is already in use.", "conflict")
    );

    const response = await request(app.getHttpServer())
      .post("/requests")
      .set("x-atlas-local-session", "local-token")
      .send({
        agentId: "agent-1",
        sellerOrganizationId: "seller-1",
        title: "Created Request",
        purpose: "Submit a paid request for a production buyer workflow test.",
        amountMinor: 2400,
        currency: "USD",
        serviceCategory: "api-access",
        serviceKey: "benchmark-api",
        idempotencyKey: "repeat-key"
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("The provided idempotency key is already in use.");
  });

  it("enforces operator role boundaries on actor routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-finance",
        workspace: "BUYER",
        userEmail: "finance@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "FINANCE",
        agentId: null
      },
      actor: createActor("BUYER", "FINANCE")
    });

    const response = await request(app.getHttpServer())
      .get("/actor/operator")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(403);
  });
});
