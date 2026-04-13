import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import {
  AtlasRolloutExecutionWorkflowError,
  createOperationalExecutionRecord,
  getOperationalExecutionSummary,
  listOperationalExecutions
} from "./rollout-executions";

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
    source: "external-oidc",
    providerMode: "external-oidc",
    sessionId: "session-1",
    principalOrganization: null,
    supportAccess: null,
    sessionIssuedAt: "2026-04-12T00:00:00.000Z",
    sessionExpiresAt: "2026-04-12T08:00:00.000Z",
    ...overrides
  };
}

describe("rollout executions workflow", () => {
  it("creates durable execution records with proof artifacts", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-rollout-execution-"));
    const reportPath = join(sandbox, "restore-report.json");
    writeFileSync(reportPath, JSON.stringify({ ok: true }), "utf8");

    const client = {
      operationalExecution: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "execution-1",
          kind: data.kind,
          mode: data.mode,
          status: data.status,
          targetEnvironment: data.targetEnvironment,
          provider: data.provider,
          actorUserEmail: data.actorUserEmail,
          summary: data.summary,
          providerOperationId: data.providerOperationId,
          targetReference: data.targetReference,
          reportPath: data.reportPath,
          metadata: data.metadata,
          completedAt: new Date("2026-04-13T00:00:00.000Z"),
          createdAt: new Date("2026-04-13T00:00:00.000Z"),
          operationalIntegration: null,
          proofArtifacts: [
            {
              id: "artifact-1",
              kind: "REPORT",
              label: "restore report",
              filePath: reportPath,
              sha256: "a".repeat(64),
              sizeBytes: 12,
              storageProvider: null,
              storageBucket: null,
              storageKey: null,
              storageUrl: null,
              metadata: {
                targetEnvironment: "STAGING"
              },
              createdAt: new Date("2026-04-13T00:00:00.000Z")
            }
          ]
        }))
      }
    } as const;

    const execution = await createOperationalExecutionRecord(
      {
        kind: "RESTORE_DRILL",
        mode: "command",
        status: "SUCCEEDED",
        targetEnvironment: "staging",
        provider: "kubernetes-job",
        actorUserEmail: "operator-admin@atlas.local",
        summary: "Restore drill executed for staging:restore-slot.",
        providerOperationId: "restore-123",
        targetReference: "atlas-staging/restore-job",
        reportPath,
        metadata: {
          targetLabel: "restore-slot"
        },
        proofArtifacts: [
          {
            kind: "REPORT",
            label: "restore report",
            filePath: reportPath,
            metadata: {
              targetEnvironment: "STAGING"
            }
          }
        ]
      },
      client as never
    );

    expect(execution.kind).toBe("RESTORE_DRILL");
    expect(execution.mode).toBe("COMMAND");
    expect(execution.proofArtifacts[0]?.label).toBe("restore report");
    expect(client.operationalExecution.create).toHaveBeenCalled();
  });

  it("lists execution records for operator governance", async () => {
    const actor = createOperatorActor();
    const client = {
      operationalExecution: {
        findMany: vi.fn(async () => [
          {
            id: "execution-1",
            kind: "DEPLOYMENT_PROMOTION",
            mode: "COMMAND",
            status: "SUCCEEDED",
            targetEnvironment: "STAGING",
            provider: "github-actions",
            actorUserEmail: actor.user.email,
            summary: "Promotion dispatched from development to staging.",
            providerOperationId: "deploy-123",
            targetReference: "atlas/payments-os/deploy.yml",
            reportPath: "/tmp/promotion.json",
            metadata: {},
            completedAt: new Date("2026-04-13T00:00:00.000Z"),
            createdAt: new Date("2026-04-13T00:00:00.000Z"),
            operationalIntegration: null,
            proofArtifacts: []
          }
        ])
      }
    } as const;

    const executions = await listOperationalExecutions(
      actor,
      {
        limit: 10
      },
      client as never
    );

    expect(executions).toHaveLength(1);
    expect(executions[0]?.provider).toBe("github-actions");
  });

  it("summarizes execution posture for operator rollout views", async () => {
    const actor = createOperatorActor();
    const client = {
      operationalExecution: {
        count: vi
          .fn()
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1),
        findFirst: vi.fn(async () => ({
          completedAt: new Date("2026-04-13T00:00:00.000Z")
        }))
      }
    } as const;

    const summary = await getOperationalExecutionSummary(actor, client as never);

    expect(summary.totalCount).toBe(6);
    expect(summary.failedCount).toBe(1);
    expect(summary.latestCompletedAt).toBe("2026-04-13T00:00:00.000Z");
  });

  it("rejects non-operator execution access", async () => {
    const actor = createOperatorActor({
      workspace: "BUYER",
      organization: {
        id: "org-buyer",
        slug: "atlas-demo-buyer",
        name: "Atlas Demo Buyer",
        kind: "BUYER"
      }
    });

    await expect(listOperationalExecutions(actor)).rejects.toBeInstanceOf(AtlasRolloutExecutionWorkflowError);
  });
});
