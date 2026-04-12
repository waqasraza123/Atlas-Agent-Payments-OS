import { executeAtlasSecretRotation } from "../packages/database/src/rollout-automation.ts";

function readArgumentValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function readArgumentValues(flag: string) {
  const values: string[] = [];

  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag) {
      const nextValue = process.argv[index + 1];
      if (nextValue) {
        values.push(nextValue);
      }
    }
  }

  return values;
}

async function main() {
  const result = await executeAtlasSecretRotation({
    environment: readArgumentValue("--environment") ?? "",
    rotatedBy: readArgumentValue("--rotated-by") ?? "",
    reason: readArgumentValue("--reason") ?? "",
    secretKeys: readArgumentValues("--key"),
    reportPath: readArgumentValue("--report"),
    manifestPath: readArgumentValue("--manifest")
  });

  process.stdout.write(`${result.reportPath}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
