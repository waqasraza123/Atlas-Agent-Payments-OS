import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type AtlasFileIntegrityManifest = {
  version: 1;
  filePath: string;
  sha256: string;
  sizeBytes: number;
  generatedAt: string;
};

export function computeAtlasFileSha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function createAtlasFileIntegrityManifest(filePath: string): AtlasFileIntegrityManifest {
  const resolvedPath = resolve(filePath);
  const content = readFileSync(resolvedPath);

  return {
    version: 1,
    filePath: resolvedPath,
    sha256: createHash("sha256").update(content).digest("hex"),
    sizeBytes: content.byteLength,
    generatedAt: new Date().toISOString()
  };
}

export function writeAtlasFileIntegrityManifest(filePath: string, outputPath?: string) {
  const manifest = createAtlasFileIntegrityManifest(filePath);
  const targetPath = resolve(outputPath ?? `${filePath}.manifest.json`);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    manifest,
    outputPath: targetPath
  };
}

export function readAtlasFileIntegrityManifest(manifestPath: string) {
  return JSON.parse(readFileSync(resolve(manifestPath), "utf8")) as AtlasFileIntegrityManifest;
}

export function verifyAtlasFileIntegrityManifest(filePath: string, manifestPath?: string) {
  const resolvedFilePath = resolve(filePath);
  const resolvedManifestPath = resolve(manifestPath ?? `${filePath}.manifest.json`);
  const manifest = readAtlasFileIntegrityManifest(resolvedManifestPath);
  const current = createAtlasFileIntegrityManifest(resolvedFilePath);

  return {
    manifest,
    manifestPath: resolvedManifestPath,
    ok:
      manifest.version === 1 &&
      manifest.filePath === resolvedFilePath &&
      manifest.sha256 === current.sha256 &&
      manifest.sizeBytes === current.sizeBytes
  };
}
