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

  it("accepts a custom prefix", () => {
    expect(VariantsConfigSchema.safeParse({ variant: { prefix: "_work-" } }).success).toBe(true);
  });

  it("rejects an empty prefix and one with a path separator", () => {
    expect(VariantsConfigSchema.safeParse({ variant: { prefix: "" } }).success).toBe(false);
    expect(VariantsConfigSchema.safeParse({ variant: { prefix: "a/b" } }).success).toBe(false);
  });

  it("accepts a seed command under variant and rejects the former top-level key", () => {
    expect(VariantsConfigSchema.safeParse({ variant: { seed: "bun run db:seed" } }).success).toBe(true);
    expect(VariantsConfigSchema.safeParse({ seed: "bun run db:seed" }).success).toBe(false);
  });

  it("accepts an open URL template on an instance and rejects an empty one", () => {
    const instance = { kind: "vite", dir: "app", open: "http://{{slug}}.vw.localhost:{{port}}" };

    expect(VariantsConfigSchema.safeParse({ variant: { instances: [instance] } }).success).toBe(true);
    expect(VariantsConfigSchema.safeParse({ variant: { instances: [{ ...instance, open: "" }] } }).success).toBe(false);
  });

  it("rejects an open URL template on a NestJS instance", () => {
    const instance = { kind: "nestjs", dir: "server", open: "http://{{slug}}.vw.localhost:{{port}}" };
    const result = VariantsConfigSchema.safeParse({ variant: { instances: [instance] } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["variant", "instances", 0, "open"]);
    }
  });

  it("accepts a chatRenamer section with every option", () => {
    const result = VariantsConfigSchema.safeParse({
      chatRenamer: {
        trigger: "hook",
        hookScope: "user",
        activationPatterns: ["/x/"],
        worktreePrefixes: ["_v-", "_work-"],
        renameExistingDays: 30,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid or unknown chatRenamer option", () => {
    expect(VariantsConfigSchema.safeParse({ chatRenamer: { renameExistingDays: -1 } }).success).toBe(false);
    expect(VariantsConfigSchema.safeParse({ chatRenamer: { trigger: "poll" } }).success).toBe(false);
    expect(VariantsConfigSchema.safeParse({ chatRenamer: { colour: "red" } }).success).toBe(false);
  });
});
