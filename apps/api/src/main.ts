import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { apiRuntime, atlasProduct } from "@atlas/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true
  });

  await app.listen(apiRuntime.port);
  console.log(`${atlasProduct.name} API listening on http://localhost:${apiRuntime.port}`);
}

bootstrap();
