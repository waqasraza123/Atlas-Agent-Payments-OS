import { writeFileIntegrityManifest, verifyFileIntegrityManifest } from "./lib/file-integrity";

function readArgumentValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function resolveMode() {
  const mode = process.argv[2];

  if (mode === "write" || mode === "verify") {
    return mode;
  }

  throw new Error("Expected mode 'write' or 'verify'.");
}

async function main() {
  const mode = resolveMode();
  const filePath = readArgumentValue("--file");
  const manifestPath = readArgumentValue("--manifest");

  if (!filePath) {
    throw new Error("Provide --file <path>.");
  }

  if (mode === "write") {
    const result = writeFileIntegrityManifest(filePath, manifestPath ?? undefined);
    process.stdout.write(`${result.outputPath}\n`);
    return;
  }

  const result = verifyFileIntegrityManifest(filePath, manifestPath ?? undefined);

  if (!result.ok) {
    throw new Error(`Integrity manifest verification failed for ${filePath}.`);
  }

  process.stdout.write(`${result.manifestPath}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
