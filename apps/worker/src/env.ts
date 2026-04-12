import { assertAtlasRuntimeConfiguration, atlasProduct, createAtlasReleaseManifest, workerRuntime } from "@atlas/config";

const runtimeValidation = assertAtlasRuntimeConfiguration("worker");
const releaseManifest = createAtlasReleaseManifest("worker");

export const workerEnv = {
  name: `${atlasProduct.name} worker`,
  redisUrl: workerRuntime.redisUrl,
  deploymentSlot: releaseManifest.deploymentSlot,
  revision: releaseManifest.revision,
  requiredVariables: runtimeValidation.requiredVariables
} as const;
