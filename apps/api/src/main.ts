import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { apiRuntime, atlasProduct, webRuntime } from "@atlas/config";
import { AppModule } from "./app.module";
import { logApiEvent } from "./lib/logger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: [webRuntime.baseUrl],
      credentials: true
    }
  });

  app.enableShutdownHooks();

  await app.listen(apiRuntime.port);
  logApiEvent("info", "bootstrap.completed", {
    product: atlasProduct.name,
    port: apiRuntime.port,
    baseUrl: apiRuntime.baseUrl
  });
}

void bootstrap().catch((error) => {
  logApiEvent("error", "bootstrap.failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
