import { createOperationId, readAtlasOperationPayload, requireText, writeAdapterResult } from "./shared.mjs";

const payload = readAtlasOperationPayload();
const provider = requireText(payload.provider, "provider");
const environment = requireText(payload.environment, "environment");
const rotatedBy = requireText(payload.rotatedBy, "rotatedBy");

if (provider === "aws-secrets-manager") {
  requireText(process.env.SECRET_ROTATION_AWS_REGION, "SECRET_ROTATION_AWS_REGION");
  requireText(process.env.SECRET_ROTATION_AWS_PREFIX, "SECRET_ROTATION_AWS_PREFIX");
}

if (provider === "hashicorp-vault") {
  requireText(process.env.SECRET_ROTATION_VAULT_ADDR, "SECRET_ROTATION_VAULT_ADDR");
  requireText(process.env.SECRET_ROTATION_VAULT_MOUNT, "SECRET_ROTATION_VAULT_MOUNT");
}

const secretKeys = Array.isArray(payload.secretKeys) ? payload.secretKeys.map((entry) => String(entry)) : [];
const operationId = createOperationId(provider, payload);
const targetRef =
  provider === "aws-secrets-manager"
    ? `${process.env.SECRET_ROTATION_AWS_REGION}:${process.env.SECRET_ROTATION_AWS_PREFIX}`
    : provider === "hashicorp-vault"
      ? `${process.env.SECRET_ROTATION_VAULT_ADDR}/${process.env.SECRET_ROTATION_VAULT_MOUNT}`
      : environment;

writeAdapterResult({
  version: 1,
  adapter: provider === "aws-secrets-manager" ? "aws-secrets-manager-rotation" : provider === "hashicorp-vault" ? "hashicorp-vault-rotation" : "generic-secret-manager",
  provider,
  operationId,
  summary: `Rotate ${secretKeys.length} secrets for ${environment} by ${rotatedBy}.`,
  targetRef,
  metadata: {
    environment,
    rotatedBy,
    secretCount: secretKeys.length,
    secretKeys: secretKeys.join(",")
  }
});

