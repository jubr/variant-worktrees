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

  it("rejects an instance with the reserved key variant-ui, naming it", () => {
    const result = VariantsConfigSchema.safeParse({
      variant: { instances: { "variant-ui": { kind: "vite", dir: "ui" } } },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (candidate) => candidate.path.join(".") === "variant.instances.variant-ui",
      );
      expect(issue?.message).toContain("variant-ui");
      expect(issue?.message).toContain("reserved");
    }
  });

  it.each([
    "ui",
    "UI",
    "Ui",
  ])("rejects an instance with the key %s, which shares VARIANT_UI_PORT with the server", (key) => {
    const result = VariantsConfigSchema.safeParse({ variant: { instances: { [key]: { kind: "vite", dir: "ui" } } } });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((candidate) => candidate.path.join(".") === `variant.instances.${key}`);
      expect(issue?.message).toContain(key);
      expect(issue?.message).toContain("VARIANT_UI_PORT");
    }
  });

  it("accepts instance keys that merely contain ui", () => {
    const instance = { kind: "vite", dir: "ui" };

    expect(
      VariantsConfigSchema.safeParse({ variant: { instances: { ui2: instance, "my-ui": instance } } }).success,
    ).toBe(true);
  });

  describe("variant.ui", () => {
    it("accepts a port", () => {
      const result = VariantsConfigSchema.safeParse({ variant: { ui: { port: 62100 } } });

      expect(result.success && result.data.variant?.ui?.port).toBe(62100);
    });

    it("accepts the setting absent", () => {
      expect(VariantsConfigSchema.safeParse({ variant: {} }).success).toBe(true);
      expect(VariantsConfigSchema.safeParse({ variant: { ui: {} } }).success).toBe(true);
    });

    it.each([0, "abc", 1.5, -1])("rejects the port %p", (port) => {
      expect(VariantsConfigSchema.safeParse({ variant: { ui: { port } } }).success).toBe(false);
    });

    it("rejects an unknown key", () => {
      expect(VariantsConfigSchema.safeParse({ variant: { ui: { color: "red" } } }).success).toBe(false);
    });
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

    expect(VariantsConfigSchema.safeParse({ variant: { instances: { app: instance } } }).success).toBe(true);
    expect(VariantsConfigSchema.safeParse({ variant: { instances: { app: { ...instance, open: "" } } } }).success).toBe(
      false,
    );
  });

  it("accepts an open URL template and a dotenv file on a NestJS instance", () => {
    const instance = { kind: "nestjs", dir: "server", open: "http://{{slug}}.vw.localhost:{{port}}", dotenv: ".env" };

    expect(VariantsConfigSchema.safeParse({ variant: { instances: { app: instance } } }).success).toBe(true);
  });

  it("rejects an empty dotenv path", () => {
    const instance = { kind: "nestjs", dir: "server", dotenv: "" };

    expect(VariantsConfigSchema.safeParse({ variant: { instances: { app: instance } } }).success).toBe(false);
  });

  it("accepts a chatRenamer section with every option", () => {
    const result = VariantsConfigSchema.safeParse({
      chatRenamer: {
        trigger: "hook",
        hookScope: "user",
        activationPatterns: ["/x/"],
        worktreePrefixes: ["_v-", "_work-"],
        renameExistingDays: 30,
        titleEventPromptLines: 20,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid or unknown chatRenamer option", () => {
    expect(VariantsConfigSchema.safeParse({ chatRenamer: { renameExistingDays: -1 } }).success).toBe(false);
    expect(VariantsConfigSchema.safeParse({ chatRenamer: { titleEventPromptLines: 0 } }).success).toBe(false);
    expect(VariantsConfigSchema.safeParse({ chatRenamer: { trigger: "poll" } }).success).toBe(false);
    expect(VariantsConfigSchema.safeParse({ chatRenamer: { colour: "red" } }).success).toBe(false);
  });
});
