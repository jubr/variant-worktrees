import { describe, expect, it } from "bun:test";
import { parseConfig } from "./parse.js";
import { VariantsConfigSchema } from "./schema.js";

const warnings = (value: unknown): string[] =>
  parseConfig(VariantsConfigSchema, value, "variants.yaml").warnings.map((warning) =>
    warning.replace("variants.yaml: unknown key ", ""),
  );

describe("VariantsConfigSchema", () => {
  it("rejects an incomplete explicit database config", () => {
    const result = VariantsConfigSchema.safeParse({ db: { port: 5432 } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["db", "host"]);
    }
  });

  it("rejects a database port that is neither an integer nor a port template", () => {
    const result = VariantsConfigSchema.safeParse({
      db: { dialect: "postgres", host: "localhost", port: "not-a-number" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "db.port")).toBe(true);
    }
  });

  it("accepts a digit string and a single ${NAME} template for db.port", () => {
    expect(
      VariantsConfigSchema.safeParse({ db: { dialect: "postgres", host: "localhost", port: "5432" } }).success,
    ).toBe(true);
    expect(
      VariantsConfigSchema.safeParse({
        db: { dialect: "postgres", host: "localhost", port: "${POSTGRES_PORT}" },
      }).success,
    ).toBe(true);
  });

  it("rejects a watch with the reserved key variant-ui, naming it", () => {
    const result = VariantsConfigSchema.safeParse({
      variant: { watches: { "variant-ui": { kind: "vite", dir: "ui" } } },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((candidate) => candidate.path.join(".") === "variant.watches.variant-ui");
      expect(issue?.message).toContain("variant-ui");
      expect(issue?.message).toContain("reserved");
    }
  });

  it.each([
    "ui",
    "UI",
    "Ui",
  ])("rejects a watch with the key %s, which shares VARIANT_UI_PORT with the server", (key) => {
    const result = VariantsConfigSchema.safeParse({ variant: { watches: { [key]: { kind: "vite", dir: "ui" } } } });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((candidate) => candidate.path.join(".") === `variant.watches.${key}`);
      expect(issue?.message).toContain(key);
      expect(issue?.message).toContain("VARIANT_UI_PORT");
    }
  });

  it("accepts watch keys that merely contain ui", () => {
    const watch = { kind: "vite", dir: "ui" };

    expect(VariantsConfigSchema.safeParse({ variant: { watches: { ui2: watch, "my-ui": watch } } }).success).toBe(true);
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

    it("ignores an unknown key with a warning", () => {
      expect(warnings({ variant: { ui: { color: "red" } } })).toEqual(["variant.ui.color"]);
    });
  });

  it("accepts a custom prefix", () => {
    expect(VariantsConfigSchema.safeParse({ variant: { prefix: "_work-" } }).success).toBe(true);
  });

  it("rejects an empty prefix and one with a path separator", () => {
    expect(VariantsConfigSchema.safeParse({ variant: { prefix: "" } }).success).toBe(false);
    expect(VariantsConfigSchema.safeParse({ variant: { prefix: "a/b" } }).success).toBe(false);
  });

  it("accepts a seed command under variant and ignores the former top-level key with a warning", () => {
    expect(warnings({ variant: { seed: "bun run db:seed" } })).toEqual([]);
    expect(warnings({ seed: "bun run db:seed" })).toEqual(["seed"]);
  });

  it("accepts a url template on a watch, rejects an empty one and ignores the former open key with a warning", () => {
    const watch = { kind: "vite", dir: "app", url: "http://${slug}.vw.localhost:${port}" };
    const parse = (value: object) => VariantsConfigSchema.safeParse({ variant: { watches: { app: value } } }).success;

    expect(parse(watch)).toBe(true);
    expect(parse({ ...watch, url: "" })).toBe(false);
    expect(
      warnings({
        variant: {
          watches: { app: { kind: "vite", dir: "app", open: "http://${slug}.vw.localhost:${port}" } },
        },
      }),
    ).toEqual(["variant.watches.app.open"]);
  });

  it("accepts a url template and an env object on a NestJS watch", () => {
    const watch = {
      kind: "nestjs",
      dir: "server",
      url: "http://${slug}.vw.localhost:${port}",
      env: { sourceFile: ".env", overrides: { PORT: "${port}" } },
    };

    expect(VariantsConfigSchema.safeParse({ variant: { watches: { app: watch } } }).success).toBe(true);
  });

  it("rejects an empty, absolute or escaping env source file", () => {
    const parse = (sourceFile: string) =>
      VariantsConfigSchema.safeParse({
        variant: { watches: { app: { kind: "nestjs", dir: "server", env: { sourceFile } } } },
      }).success;

    expect(parse("")).toBe(false);
    expect(parse("../.env")).toBe(false);
    expect(parse("/etc/app.env")).toBe(false);
    expect(parse("config/.env")).toBe(true);
  });

  it("ignores the former dotenv, dotenvSource and envAlways keys and a bare env map with a warning each", () => {
    const warned = (extra: object) =>
      warnings({ variant: { watches: { app: { kind: "nestjs", dir: "server", ...extra } } } });

    expect(warned({ dotenv: ".env" })).toEqual(["variant.watches.app.dotenv"]);
    expect(warned({ dotenvSource: "~/app.env" })).toEqual(["variant.watches.app.dotenvSource"]);
    expect(warned({ envAlways: { A: "b" } })).toEqual(["variant.watches.app.envAlways"]);
    expect(warned({ env: { PORT: "${port}" } })).toEqual(["variant.watches.app.env.PORT"]);
    expect(warned({ env: { overrides: {}, other: 1 } })).toEqual(["variant.watches.app.env.other"]);
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

  it("rejects an invalid chatRenamer option and ignores an unknown one with a warning", () => {
    expect(VariantsConfigSchema.safeParse({ chatRenamer: { renameExistingDays: -1 } }).success).toBe(false);
    expect(VariantsConfigSchema.safeParse({ chatRenamer: { titleEventPromptLines: 0 } }).success).toBe(false);
    expect(VariantsConfigSchema.safeParse({ chatRenamer: { trigger: "poll" } }).success).toBe(false);
    expect(warnings({ chatRenamer: { colour: "red" } })).toEqual(["chatRenamer.colour"]);
  });
});
