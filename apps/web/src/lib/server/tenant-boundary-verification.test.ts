import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findTenantBoundaryViolations } from "./tenant-boundary-verification";

const createdDirectories: string[] = [];

function createRepoFixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "atlas-tenant-boundary-"));
  createdDirectories.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = join(root, relativePath);
    mkdirSync(dirname(absolutePath), {
      recursive: true
    });
    writeFileSync(absolutePath, contents, "utf8");
  }

  return root;
}

afterEach(() => {
  for (const directory of createdDirectories.splice(0, createdDirectories.length)) {
    rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

describe("tenant boundary verification", () => {
  it("passes when guarded workspace loaders avoid direct prisma access", () => {
    const root = createRepoFixture({
      "apps/web/src/lib/server/workspace-data.ts": 'import { getWorkspaceOverviewForActor } from "@atlas/database";\n',
      "apps/web/src/lib/server/workspace-surface-data.ts": 'import { listWorkspaceSurfacePrimaryItemsForActor } from "@atlas/database";\n'
    });

    expect(findTenantBoundaryViolations(root)).toEqual([]);
  });

  it("reports guarded workspace loaders that use prisma directly", () => {
    const root = createRepoFixture({
      "apps/web/src/lib/server/workspace-data.ts": 'import { prisma } from "@atlas/database";\nconst count = prisma.agent.count({});\n',
      "apps/web/src/lib/server/workspace-surface-data.ts": 'export const safe = true;\n'
    });

    expect(findTenantBoundaryViolations(root)).toEqual([
      {
        filePath: "apps/web/src/lib/server/workspace-data.ts",
        reason: "direct Prisma client usage"
      },
      {
        filePath: "apps/web/src/lib/server/workspace-data.ts",
        reason: "direct prisma import"
      }
    ]);
  });
});
