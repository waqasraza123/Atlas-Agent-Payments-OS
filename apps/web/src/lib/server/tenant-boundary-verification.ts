import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const guardedFiles = [
  "apps/web/src/lib/server/workspace-data.ts",
  "apps/web/src/lib/server/workspace-surface-data.ts"
] as const;

const disallowedPatterns = [
  {
    label: "direct Prisma client usage",
    pattern: /\bprisma\./
  },
  {
    label: "direct prisma import",
    pattern: /import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s*"@atlas\/database"/
  }
] as const;

export type AtlasTenantBoundaryViolation = {
  filePath: string;
  reason: string;
};

export function findTenantBoundaryViolations(repoRoot: string): AtlasTenantBoundaryViolation[] {
  const violations: AtlasTenantBoundaryViolation[] = [];

  for (const relativePath of guardedFiles) {
    const absolutePath = resolve(repoRoot, relativePath);
    const fileContents = readFileSync(absolutePath, "utf8");

    for (const rule of disallowedPatterns) {
      if (rule.pattern.test(fileContents)) {
        violations.push({
          filePath: relativePath,
          reason: rule.label
        });
      }
    }
  }

  return violations;
}
