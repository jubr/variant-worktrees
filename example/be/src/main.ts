import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  // Bun loads .env from the working directory itself; variables already in the environment win.
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  // The variant's {{port}}: each variant gets its own, so several run side by side.
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
