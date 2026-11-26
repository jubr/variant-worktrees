import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, readRuntime, STATE_FILE } from "variant-config";
import { createVariantClient } from "../index.js";
import { variantVariables } from "../run-context.js";

/** Specification: openspec/specs/variant-api/core/spec.md (One SQLite target for every slug) */

const parents: string[] = [];
afterEach(() => {
  for (const parent of parents.splice(0)) {
    rmSync(parent, { recursive: true, force: true });
  }
});

/** A git repository with a SQLite `variants.yaml`, and a client with worktrees. */
const project = (yaml = "db:\n  dialect: sqlite\n") => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-create-")));
  parents.push(parent);
  const repo = join(parent, "repo");
  const git = (...args: string[]): void => void execFileSync("git", ["-C", repo, ...args], { stdio: "ignore" });
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  git("config", "user.email", "variant@example.test");
  git("config", "user.name", "Variant Tests");
  writeFileSync(join(repo, ".gitignore"), ".cache\n_v-*\n");
  writeFileSync(join(repo, "README.md"), "x\n");
  git("add", ".gitignore", "README.md");
  git("commit", "-q", "-m", "initial");
  writeFileSync(join(repo, "variants.yaml"), yaml);
  const config = loadConfig({ cwd: repo, env: {}, environment: () => ({}) });
  const client = createVariantClient({ config, cwd: repo, stateDir: join(repo, ".cache", "variants") });
  return { parent, repo, config, client };
};

describe("create for a SQLite project", () => {
  it("records the file of main as target and runtime.db.database, never public", async () => {
    const { repo, client } = project();
    const file = join(repo, ".cache", "variants", "main.sqlite");

    const record = await client.create("main");

    expect(record.target).toBe(file);
    expect(readRuntime(repo, {})?.db).toEqual({ dialect: "sqlite", database: file });
    expect(readFileSync(join(repo, STATE_FILE), "utf8")).not.toContain("public");
    expect(existsSync(file)).toBe(false);
  });

  it("records the file of a slug below its worktree", async () => {
    const { parent, client } = project();
    const worktree = join(parent, "repo", "_v-demo");
    const file = join(worktree, ".cache", "variants", "demo.sqlite");

    const record = await client.create("demo");

    expect(record.target).toBe(file);
    expect(record.database).toBe(".cache/variants/demo.sqlite");
    expect(readRuntime(worktree, {})?.db).toEqual({ dialect: "sqlite", database: file });
  });

  it("names an absolute file as the database and the target", async () => {
    const { client } = project("db:\n  dialect: sqlite\n  database: /tmp/variant-create-abs/{slug}.sqlite\n");

    const record = await client.create("demo");

    expect(record.database).toBe("/tmp/variant-create-abs/demo.sqlite");
    expect(record.target).toBe(record.database);
  });

  it("gives a run the same file as SQLITE_DATABASE and VARIANT_TARGET", async () => {
    const { parent, config, client } = project();
    const record = await client.create("demo");

    const worktree = join(parent, "repo", "_v-demo");
    const variables = variantVariables(config, {
      slug: "demo",
      abbr: "r",
      target: record.target,
      worktree,
      isPrimary: false,
      primary: join(parent, "repo"),
      projectDir: worktree,
      primaryProjectDir: join(parent, "repo"),
      ports: {},
      urls: {},
    });

    expect(variables.SQLITE_DATABASE).toBe(join(worktree, ".cache", "variants", "demo.sqlite"));
    expect(variables.VARIANT_TARGET).toBe(variables.SQLITE_DATABASE);
  });

  it("heals the public target an earlier version recorded for main and keeps createdAt", async () => {
    const { repo, client } = project();
    mkdirSync(join(repo, ".cache", "variant"), { recursive: true });
    writeFileSync(
      join(repo, STATE_FILE),
      `slug: main\ncreatedAt: 2026-01-02_03:04:05\ndir: ${repo}\ndialect: sqlite\ntarget: public\n`,
    );

    await client.create("main");

    const runtime = readRuntime(repo, {});
    expect(runtime?.db).toEqual({ dialect: "sqlite", database: join(repo, ".cache", "variants", "main.sqlite") });
    expect(runtime?.createdAt).toBe("2026-01-02_03:04:05");
    expect(readFileSync(join(repo, STATE_FILE), "utf8")).toContain(
      `target: ${join(repo, ".cache", "variants", "main.sqlite")}`,
    );
  });

  it("lists the files of the worktrees and leaves main out of the catalog", async () => {
    const { parent, repo, client } = project();
    await client.create("demo");
    for (const file of [
      join(parent, "repo", "_v-demo", ".cache", "variants", "demo.sqlite"),
      join(repo, ".cache", "variants", "main.sqlite"),
    ]) {
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, "");
    }

    const records = await client.list();

    expect(records.map((record) => record.slug)).toEqual(["demo"]);
    expect(records[0]?.database).toBe(".cache/variants/demo.sqlite");
    expect(records[0]?.target).toBe(join(parent, "repo", "_v-demo", ".cache", "variants", "demo.sqlite"));
  });

  it("fails naming the slug and db.database when two slugs would share the file of main", async () => {
    const { repo, config } = project("db:\n  dialect: sqlite\n  database: app.sqlite\n");
    const shared = createVariantClient({
      config,
      cwd: repo,
      stateDir: join(repo, ".cache", "variants"),
      worktree: false,
    });

    await expect(shared.create("demo")).rejects.toThrow(/demo.*db\.database.*app\.sqlite/s);
  });
});
