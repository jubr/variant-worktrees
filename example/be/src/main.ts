import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { openEvents, recordRequests } from "./events.js";
import { logRequest } from "./request-log.js";

async function bootstrap(): Promise<void> {
  // Bun loads .env from the working directory itself; variables already in the environment win.
  const app = await NestFactory.create(AppModule);
  // The variant's database, SQLITE_DATABASE: the events table is made when it is absent.
  const events = openEvents();
  process.on("exit", () => events.close());
  app.use(logRequest);
  app.use(recordRequests(events));
  app.setGlobalPrefix("api");
  // The variant's ${port}: each variant gets its own, so several run side by side.
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  events.record("startup", `listening on port ${port}`);
}

void bootstrap();
