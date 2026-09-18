import { describe, expect, it } from "bun:test";
import { VariantsConfigSchema } from "../src/schema.js";

describe("VariantsConfigSchema", () => {
  it("rejects an incomplete explicit database config", () => {
    const result = VariantsConfigSchema.safeParse({ db: { port: 5432 } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["db", "host"]);
    }
  });

  it("rejects a database port with the wrong type", () => {
    const result = VariantsConfigSchema.safeParse({
      db: { dialect: "postgres", host: "localhost", port: "5432" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "db.port")).toBe(true);
    }
  });
});
