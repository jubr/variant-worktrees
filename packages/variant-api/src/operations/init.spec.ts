import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { createVariantClient } from "../index.js";
import { fakeMise } from "../test/mise-mock.js";

/** Specification: openspec/specs/variant-api/init/spec.md */

let root: string;
let saved: NodeJS.ProcessEnv;

/** The variables detection reads; init merges Mise's values over the process environment, so a test clears them. */
const DETECTED = /^(DATABASE_URL|(POSTGRES|MYSQL|MARIADB|SQLITE)_[A-Z]+)$/;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join("/tmp", "variant-init-")));
  saved = { ...process.env };
  for (const name of Object.keys(process.env)) {
    if (DETECTED.test(name)) {
      delete process.env[name];
    }
  }
});

afterEach(() => {
  process.env = saved;
  rmSync(root, { recursive: true, force: true });
});

const put = (path: string, content = ""): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const files = (): string[] => readdirSync(root).filter((name) => name !== "fake-mise-state" && name !== "mise");

const setup = (mise: Parameters<typeof fakeMise>[1] = {}) => {
  const fake = fakeMise(root, { configLs: "[]", ...mise });
  const client = createVariantClient({ cwd: root, miseBinPath: fake.binary, worktree: false });
  return { fake, client };
};

describe("init", () => {
  it("writes variants.yaml, .gitignore and mise.toml with the defaults", async () => {
    const { client } = setup({
      env: "POSTGRES_HOST=db\nPOSTGRES_DB=app\nPOSTGRES_PASSWORD=pw\n",
      set: "POSTGRES_PASSWORD pw ~/mise.toml\n",
    });

    const result = await client.init();

    expect(result.file).toBe(join(root, "variants.yaml"));
    const config = parseYaml(read("variants.yaml"));
    expect(config.variant.prefix).toBe("_v-");
    expect(config.db).toMatchObject({
      dialect: "postgres",
      host: "${POSTGRES_HOST}",
      database: "app",
      password: "${POSTGRES_PASSWORD}",
    });
    expect(read("variants.yaml")).not.toContain("pw\n");
    expect(read(".gitignore")).toBe("_v-*\n");
    expect(read("mise.toml")).toContain("github:jubr/variant-worktrees");
    expect(result.gitignore).toMatchObject({ status: "created", changed: true });
    expect(result.mise).toMatchObject({ status: "created", changed: true, file: join(root, "mise.toml") });
    expect(result.detected).toMatchObject({ dialect: "postgres", prefix: "_v-" });
  });

  it("writes a custom prefix to the file and .gitignore", async () => {
    const { client } = setup();

    await client.init({ prefix: "wt-" });

    expect(parseYaml(read("variants.yaml")).variant.prefix).toBe("wt-");
    expect(read(".gitignore")).toBe("wt-*\n");
  });

  it.each(["", "a/b", "a\\b"])("refuses the prefix %p and writes nothing", async (prefix) => {
    const { client } = setup();
    const before = files();

    await expect(client.init({ prefix })).rejects.toThrow(/prefix/i);

    expect(files()).toEqual(before);
  });

  it("skips the steps that are turned off", async () => {
    const { client, fake } = setup();

    const result = await client.init({ gitignore: false, mise: false });

    expect(files().sort()).toEqual(["variants.yaml"]);
    expect(result.gitignore).toMatchObject({ status: "skipped", changed: false });
    expect(result.mise).toMatchObject({ status: "skipped", changed: false, file: null });
    expect(fake.callsOf("config")).toEqual([]);
  });

  it("skips the file step and still handles the other steps", async () => {
    put("variants.yaml", "db:\n  dialect: sqlite\n");
    const { client } = setup();

    const result = await client.init({ file: false });

    expect(result.file).toBeNull();
    expect(result.detected).toBeNull();
    expect(read("variants.yaml")).toBe("db:\n  dialect: sqlite\n");
    expect(read(".gitignore")).toBe("_v-*\n");
    expect(read("mise.toml")).toContain("github:jubr");
  });

  it("refuses an existing variants.yaml naming it and changes nothing", async () => {
    put("variants.yaml", "db:\n  dialect: sqlite\n");
    const { client } = setup();
    const before = files();

    await expect(client.init()).rejects.toThrow(join(root, "variants.yaml"));

    expect(files()).toEqual(before);
    expect(read("variants.yaml")).toBe("db:\n  dialect: sqlite\n");
  });

  it("refuses an existing variants.yml too", async () => {
    put("variants.yml", "db:\n  dialect: sqlite\n");
    const { client } = setup();

    await expect(client.init()).rejects.toThrow(join(root, "variants.yml"));
  });

  it("replaces the file with force", async () => {
    put("variants.yaml", "variant:\n  prefix: old-\n");
    const { client } = setup();

    await client.init({ force: true });

    expect(parseYaml(read("variants.yaml")).variant.prefix).toBe("_v-");
  });

  it("writes a file that loads back to the detected database", async () => {
    const { client, fake } = setup({ env: "MARIADB_HOST=maria\nMARIADB_DATABASE=shop\n" });

    await client.init();

    const loaded = createVariantClient({ cwd: root, miseBinPath: fake.binary, worktree: false }).config();
    expect(loaded.db).toMatchObject({ dialect: "mysql", host: "maria", database: "shop" });
  });

  describe(".gitignore", () => {
    it("appends on its own line after a file without a trailing newline", async () => {
      put(".gitignore", "node_modules");
      const { client } = setup();

      const result = await client.init({ file: false, mise: false });

      expect(read(".gitignore")).toBe("node_modules\n_v-*\n");
      expect(result.gitignore).toMatchObject({ status: "appended", changed: true });
    });

    it("keeps a trailing newline as it is", async () => {
      put(".gitignore", "node_modules\n");
      const { client } = setup();

      await client.init({ file: false, mise: false });

      expect(read(".gitignore")).toBe("node_modules\n_v-*\n");
    });

    it("does not change a file that holds the line and says so", async () => {
      put(".gitignore", "a\n_v-*\nb\n");
      const { client } = setup();

      const result = await client.init({ file: false, mise: false });

      expect(read(".gitignore")).toBe("a\n_v-*\nb\n");
      expect(result.gitignore).toMatchObject({ status: "unchanged", changed: false });
    });
  });

  describe("mise step", () => {
    it("names the changed file when mise.toml exists without the tool", async () => {
      put("mise.toml", '[tools]\nnode = "22"\n');
      const { client } = setup({ configLs: JSON.stringify([{ path: join(root, "mise.toml") }]) });

      const result = await client.init();

      expect(result.mise).toMatchObject({ status: "added", changed: true, file: join(root, "mise.toml") });
    });

    it("reports an invalid Mise file and still writes the other steps", async () => {
      put("mise.toml", "[tools\n");
      const { client } = setup({ configLs: JSON.stringify([{ path: join(root, "mise.toml") }]) });

      const result = await client.init();

      expect(result.mise.status).toBe("failed");
      expect(result.mise.message).toContain("not valid TOML");
      expect(result.mise.changed).toBe(false);
      expect(read("variants.yaml")).toContain("dialect");
      expect(read(".gitignore")).toBe("_v-*\n");
    });
  });

  it("starts no state directory", async () => {
    const { client } = setup();

    await client.init({ mise: false });

    expect(readdirSync(root)).not.toContain(".cache");
  });
});
