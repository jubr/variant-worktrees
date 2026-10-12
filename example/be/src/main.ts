import "reflect-metadata";
import { existsSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  // Variables already in the environment win over .env.
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  // The variant's {{port}}: each variant gets its own, so several run side by side.
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
