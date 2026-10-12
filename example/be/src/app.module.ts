import { Controller, Get, Module } from "@nestjs/common";
import { DatabaseSync } from "node:sqlite";

@Controller()
class AppController {
  @Get()
  notes(): { name: string; slug: string; notes: string[] } {
    const database = new DatabaseSync(process.env.SQLITE_DATABASE ?? "./example.sqlite");
    try {
      const rows = database.prepare("SELECT text FROM notes ORDER BY id").all() as { text: string }[];
      return { name: "example-be", slug: process.env.VARIANT_SLUG ?? "main", notes: rows.map((row) => row.text) };
    } catch {
      // Not seeded yet.
      return { name: "example-be", slug: process.env.VARIANT_SLUG ?? "main", notes: [] };
    } finally {
      database.close();
    }
  }
}

@Module({ controllers: [AppController] })
export class AppModule {}
