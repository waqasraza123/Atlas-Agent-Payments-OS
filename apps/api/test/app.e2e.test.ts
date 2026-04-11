import "reflect-metadata";
import type { AtlasActorContext } from "@atlas/auth";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { ActorResolutionService } from "../src/modules/actor/actor.service";

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
