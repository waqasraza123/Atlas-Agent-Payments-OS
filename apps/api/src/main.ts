import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { apiRuntime, assertAtlasRuntimeConfiguration, atlasProduct, createAtlasReleaseManifest, webRuntime } from "@atlas/config";
import { AppModule } from "./app.module";
import { logApiEvent } from "./lib/logger";

async function bootstrap() {
  const runtimeValidation = assertAtlasRuntimeConfiguration("api");
  const releaseManifest = createAtlasReleaseManifest("api");
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
    baseUrl: apiRuntime.baseUrl,
    deploymentSlot: releaseManifest.deploymentSlot,
    revision: releaseManifest.revision,
    requiredVariables: runtimeValidation.requiredVariables.length
  });
}

void bootstrap().catch((error) => {
  logApiEvent("error", "bootstrap.failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
