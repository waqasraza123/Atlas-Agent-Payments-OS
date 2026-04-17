import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const guardedFiles = [
  "apps/web/src/lib/server/workspace-data.ts",
  "apps/web/src/lib/server/workspace-surface-data.ts"
];

const disallowedPatterns = [
  {
    label: "direct Prisma client usage",
    pattern: /\bprisma\./
  },
  {
    label: "direct prisma import",
    pattern: /import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s*"@atlas\/database"/
  }
];

const repoRoot = resolve(import.meta.dirname, "..");
const violations = [];

for (const relativePath of guardedFiles) {
  const fileContents = readFileSync(resolve(repoRoot, relativePath), "utf8");

  for (const rule of disallowedPatterns) {
    if (rule.pattern.test(fileContents)) {
      violations.push(`${relativePath}: ${rule.label}`);
    }
  }
}

if (violations.length === 0) {
  console.log("Tenant-boundary verification passed.");
  process.exit(0);
}

for (const violation of violations) {
  console.error(violation);
}

process.exit(1);
