import { assertAtlasRuntimeConfiguration, atlasProduct, createAtlasReleaseManifest, observabilityRuntime, workerRuntime } from "@atlas/config";

const runtimeValidation = assertAtlasRuntimeConfiguration("worker");
const releaseManifest = createAtlasReleaseManifest("worker");

export const workerEnv = {
  name: `${atlasProduct.name} worker`,
  redisUrl: workerRuntime.redisUrl,
  automationScheduleMode: observabilityRuntime.automationScheduleMode,
  automationIntervalMinutes: observabilityRuntime.automationScheduleIntervalMinutes,
  deploymentSlot: releaseManifest.deploymentSlot,
  revision: releaseManifest.revision,
  requiredVariables: runtimeValidation.requiredVariables
} as const;
