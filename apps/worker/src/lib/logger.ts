import { writeAtlasStructuredLog, type AtlasLogLevel } from "@atlas/config";

export function log(message: string, context: Record<string, unknown> = {}, level: AtlasLogLevel = "info") {
  writeAtlasStructuredLog("worker", level, message, context);
}
