import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // The variant's {{port}}: each variant picks its own so several can run side by side.
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
