import { atlasProduct, workerRuntime } from "@atlas/config";

export const workerEnv = {
  name: `${atlasProduct.name} worker`,
  redisUrl: workerRuntime.redisUrl
} as const;
