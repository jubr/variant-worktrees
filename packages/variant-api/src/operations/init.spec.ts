import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { loadConfig, migrateFile } from "variant-config";
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
      type: "postgres",
      host: "${POSTGRES_HOST}",
      database: "${POSTGRES_DB}",
      password: "${POSTGRES_PASSWORD}",
    });
    expect(read("variants.yaml")).not.toContain("pw\n");
    expect(read(".gitignore")).toBe("_v-*\n");
    expect(read("mise.toml")).toContain("packslip:jubr/variant-worktrees");
    expect(result.gitignore).toMatchObject({ status: "created", changed: true });
    expect(result.mise).toMatchObject({ status: "created", changed: true, file: join(root, "mise.toml") });
    expect(result.detected).toMatchObject({ type: "postgres", prefix: "_v-" });
  });

  it("writes a final file when no database is detected: no db key, nothing left to migrate", async () => {
    const { client } = setup();

    await client.init();

    expect(parseYaml(read("variants.yaml"))).not.toHaveProperty("db");
    expect(read("variants.yaml").split("\n")[0]).toStartWith("# yaml-language-server: $schema=");
    expect(migrateFile(join(root, "variants.yaml"), {})).toBeUndefined();
    expect(files()).not.toContain("variants.yaml~");
  });

  it("writes the default git branch and reports it", async () => {
    const git = (...args: string[]): void => {
      execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
    };
    execFileSync("git", ["init", "-q", "-b", "master", root]);
    git("config", "user.email", "variant@example.test");
    git("config", "user.name", "Variant Tests");
    // AIDEV-NOTE: names a branch that never exists, so the machine's own global init.defaultBranch cannot decide the case.
    git("config", "init.defaultBranch", "no-such-branch");
    git("commit", "-q", "--allow-empty", "-m", "initial");
    const { client } = setup();

    const result = await client.init();

    expect(parseYaml(read("variants.yaml")).variant.baseBranch).toBe("master");
    expect(read("variants.yaml")).toContain("baseBranch: master # local branch");
    expect(result.detected?.baseBranch).toBe("master");
  });

  it("lets a create after init start from master in a repository whose only branch is master", async () => {
    const git = (...args: string[]): string => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
    execFileSync("git", ["init", "-q", "-b", "master", root]);
    git("config", "user.email", "variant@example.test");
    git("config", "user.name", "Variant Tests");
    // AIDEV-NOTE: names a branch that never exists, so the machine's own global init.defaultBranch cannot decide the case.
    git("config", "init.defaultBranch", "no-such-branch");
    put("README.md", "test\n");
    git("add", "README.md");
    git("commit", "-q", "-m", "initial");
    await setup().client.init({ gitignore: false, mise: false });

    const config = loadConfig({ cwd: root, env: {} });
    const created = await createVariantClient({
      config: { ...config, db: { type: "sqlite" } },
      cwd: root,
      stateDir: join(root, ".cache", "variants"),
    }).create("demo");

    expect(config.variant.baseBranch).toBe("master");
    expect(git("-C", created.worktree as string, "branch", "--show-current")).toBe("feat/demo");
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
    put("variants.yaml", "db:\n  type: sqlite\n");
    const { client } = setup();

    const result = await client.init({ file: false });

    expect(result.file).toBeNull();
    expect(result.detected).toBeNull();
    expect(read("variants.yaml")).toBe("db:\n  type: sqlite\n");
    expect(read(".gitignore")).toBe("_v-*\n");
    expect(read("mise.toml")).toContain("packslip:jubr");
  });

  it("refuses an existing variants.yaml naming it and changes nothing", async () => {
    put("variants.yaml", "db:\n  type: sqlite\n");
    const { client } = setup();
    const before = files();

    await expect(client.init()).rejects.toThrow(join(root, "variants.yaml"));

    expect(files()).toEqual(before);
    expect(read("variants.yaml")).toBe("db:\n  type: sqlite\n");
  });

  it("refuses an existing variants.yml too", async () => {
    put("variants.yml", "db:\n  type: sqlite\n");
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
    expect(loaded.db).toMatchObject({ type: "mysql", host: "maria", database: "shop__${schema}" });
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
      expect(parseYaml(read("variants.yaml")).variant.prefix).toBe("_v-");
      expect(read(".gitignore")).toBe("_v-*\n");
    });
  });

  it("starts no state directory", async () => {
    const { client } = setup();

    await client.init({ mise: false });

    expect(readdirSync(root)).not.toContain(".cache");
  });
});

describe("init Bun check", () => {
  /** A directory holding an executable `bun` that prints `version`. */
  const stubBun = (name: string, version: string): string => {
    const directory = join(root, name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "bun"), `#!/bin/sh\necho ${version}\n`);
    chmodSync(join(directory, "bun"), 0o755);
    return directory;
  };
  const pinned = (version: string): string => JSON.stringify([{ version, active: true }]);

  it("reports a differing Bun with its hint and still does the other steps", async () => {
    process.env.PATH = `${stubBun("foreign", "1.3.0")}:${stubBun("mise-bun", "1.4.2")}:${saved.PATH}`;
    const { client } = setup({ lsCurrent: pinned("1.4.2"), which: join(root, "mise-bun", "bun") });

    const result = await client.init();

    expect(result.bun.status).toBe("differs");
    expect(result.bun.message).toContain("1.3.0");
    expect(result.bun.message).toContain("1.4.2");
    expect(result.bun.hint.length).toBeGreaterThan(0);
    expect(result.bun.hint.join("\n")).toContain("which -a bun");
    expect(read(".gitignore")).toBe("_v-*\n");
    expect(read("mise.toml")).toContain("packslip:jubr");
  });

  it("reports a matching Bun without a hint", async () => {
    process.env.PATH = `${stubBun("mise-bun", "1.4.2")}:${saved.PATH}`;
    const { client } = setup({ lsCurrent: pinned("1.4.2") });

    const result = await client.init();

    expect(result.bun).toMatchObject({ status: "matches", hint: [] });
  });

  it("reports unchecked when no Mise executable is found and still succeeds", async () => {
    process.env.PATH = "/nonexistent";
    const client = createVariantClient({ cwd: root, worktree: false, miseBinPath: undefined });

    const result = await client.init({ mise: false });

    expect(result.bun).toMatchObject({ status: "unchecked", hint: [] });
    expect(result.file).toBe(join(root, "variants.yaml"));
  });
});
