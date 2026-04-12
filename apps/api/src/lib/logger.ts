import { writeAtlasStructuredLog, type AtlasLogLevel } from "@atlas/config";

export function logApiEvent(level: AtlasLogLevel, message: string, fields: Record<string, unknown> = {}) {
  writeAtlasStructuredLog("api", level, message, fields);
}
