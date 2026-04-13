import type { AtlasActorContext } from "@atlas/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

function createOperatorActor(overrides?: Partial<AtlasActorContext>): AtlasActorContext {
  return {
    user: {
      id: "user-operator",
      email: "operator-admin@atlas.local",
      name: "Operator Admin"
    },
    organization: {
      id: "org-operator",
      slug: "atlas-demo-operator",
      name: "Atlas Demo Operator",
      kind: "OPERATOR"
    },
    membership: {
      id: "membership-operator",
      role: "ADMIN"
    },
    workspace: "OPERATOR",
    agentId: null,
    source: "local-development",
    providerMode: "local-signed",
    sessionId: null,
    principalOrganization: null,
    supportAccess: null,
    sessionIssuedAt: "2026-04-12T00:00:00.000Z",
    sessionExpiresAt: "2026-04-12T08:00:00.000Z",
    ...overrides
  };
}

describe("operator session governance", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows local-development operator governance in local functional-alpha runtime", async () => {
    vi.resetModules();
    const { assertAtlasOperatorSessionGovernance } = await import("./operator-session-governance");

    expect(() =>
      assertAtlasOperatorSessionGovernance(createOperatorActor(), {
        surface: "Operator governance actions",
        createError: (message) => new Error(message)
      })
    ).not.toThrow();
  });

  it("rejects local-development governance sessions outside local-development environments", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.resetModules();
    const { assertAtlasOperatorSessionGovernance } = await import("./operator-session-governance");

    expect(() =>
      assertAtlasOperatorSessionGovernance(createOperatorActor(), {
        surface: "Operator governance actions",
        createError: (message) => new Error(message)
      })
    ).toThrow(/provider-backed Atlas session outside local and development/i);
  });

  it("rejects non-external sessions during ga release operations", async () => {
    vi.stubEnv("RELEASE_STAGE", "ga");
    vi.resetModules();
    const { assertAtlasOperatorSessionGovernance } = await import("./operator-session-governance");

    expect(() =>
      assertAtlasOperatorSessionGovernance(
        createOperatorActor({
          source: "identity-provider",
          providerMode: "identity-bridge",
          sessionId: "session-1"
        }),
        {
          surface: "Operator governance actions",
          createError: (message) => new Error(message)
        }
      )
    ).toThrow(/external OIDC Atlas sessions during ga release operations/i);
  });

  it("allows external oidc governance sessions during ga release operations", async () => {
    vi.stubEnv("RELEASE_STAGE", "ga");
    vi.resetModules();
    const { assertAtlasOperatorSessionGovernance } = await import("./operator-session-governance");

    expect(() =>
      assertAtlasOperatorSessionGovernance(
        createOperatorActor({
          source: "identity-provider",
          providerMode: "external-oidc",
          sessionId: "session-1"
        }),
        {
          surface: "Operator governance actions",
          createError: (message) => new Error(message)
        }
      )
    ).not.toThrow();
  });

  it("rejects local-signed support grants outside local-development environments", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.resetModules();
    const { assertAtlasSupportGrantProviderMode } = await import("./operator-session-governance");

    expect(() =>
      assertAtlasSupportGrantProviderMode("LOCAL_SIGNED", {
        surface: "Support-access activation",
        createError: (message) => new Error(message)
      })
    ).toThrow(/provider-backed support grants outside local and development/i);
  });
});
