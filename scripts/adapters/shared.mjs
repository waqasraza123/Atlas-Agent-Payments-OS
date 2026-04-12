import { createHash } from "node:crypto";

export function readAtlasOperationPayload() {
  const raw = process.env.ATLAS_OPERATION_PAYLOAD?.trim() ?? "";

  if (!raw) {
    throw new Error("ATLAS_OPERATION_PAYLOAD is required.");
  }

  return JSON.parse(raw);
}

export function requireText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

export function readOptionalText(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function createOperationId(provider, payload) {
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 12);

  return `${provider}-${hash}`;
}

export function writeAdapterResult(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

