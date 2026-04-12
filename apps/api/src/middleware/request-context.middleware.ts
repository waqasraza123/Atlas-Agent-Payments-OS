import { randomUUID } from "node:crypto";
import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { logApiEvent } from "../lib/logger";

type ApiRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: "finish", listener: () => void): void;
};

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: ApiRequest, response: ApiResponse, next: () => void) {
    const requestIdHeader = request.headers["x-atlas-request-id"];
    const requestId = typeof requestIdHeader === "string" ? requestIdHeader : randomUUID();
    const startedAt = Date.now();
    const requestPath = request.originalUrl ?? request.url ?? "/";

    response.setHeader("x-atlas-request-id", requestId);
    response.on("finish", () => {
      logApiEvent("info", "request.completed", {
        requestId,
        method: request.method ?? "UNKNOWN",
        path: requestPath,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt
      });
    });

    next();
  }
}
