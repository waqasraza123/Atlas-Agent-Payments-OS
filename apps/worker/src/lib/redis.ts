import IORedis from "ioredis";
import { workerEnv } from "../env";

export function createRedisConnection() {
  return new IORedis(workerEnv.redisUrl, {
    maxRetriesPerRequest: null
  });
}
