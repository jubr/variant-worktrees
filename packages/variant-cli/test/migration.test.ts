import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, schemaHeaderFor } from "variant-config";
import { migrateConfigFiles } from "../src/migration.js";
import { runCli } from "./support/cli.js";

const HEADER = schemaHeaderFor("variants.yaml");
const LOCAL_HEADER = schemaHeaderFor("variants.local.yaml");
// AIDEV-NOTE: the fixtures carry the schema header so the tests of the renames see no header change; the last describe covers it
const BARE_OLD = "db:\n  dialect: sqlite\nvariant:\n  open: false\n  instances:\n    be: { kind: nestjs, dir: . }\n";
const BARE_NEW = "db:\n  dialect: sqlite\nvariant:\n  open: false\n  watches:\n    be: { kind: nestjs, dir: . }\n";
const OLD = `${HEADER}\n\n${BARE_OLD}`;
const NEW = `${HEADER}\n\n${BARE_NEW}`;
// AIDEV-NOTE: CI="" because a CI runner sets CI=true, which turns the rewrite off; an empty value counts as unset
const ENV = { CI: "", VARIANT_MIGRATE: "" };

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** A git repository holding `variants.yaml`; committed or only written to the working tree. */
const project = (yaml: string, committed: boolean): { directory: string; file: string; config: string } => {
  const directory = mkdtempSync(join("/tmp", "variant-cli-migrate-"));
  directories.push(directory);
  const git = (...args: string[]) => execFileSync("git", ["-C", directory, ...args], { stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "variant@example.test");
  git("config", "user.name", "Variant Tests");
  writeFileSync(join(directory, ".gitignore"), "variants.local.yaml\n.cache\n");
  const file = join(directory, "variants.yaml");
  writeFileSync(file, yaml);
  if (committed) {
    git("add", ".");
    git("commit", "-q", "-m", "initial");
  }
  return { directory, file, config: file };
};

describe("configuration migration in the CLI", () => {
  it("rewrites a tracked clean variants.yaml and says how to review and revert it", async () => {
    const { file } = project(OLD, true);

    const result = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV });

    expect(result.exitCode).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(NEW);
    expect(result.stderr).toContain(file);
    expect(result.stderr).toContain("variant.instances");
    expect(result.stderr).toContain("variant.watches");
    expect(result.stderr).toContain(`git diff -- ${file}`);
    expect(result.stderr).toContain(`git checkout -- ${file}`);
    expect(JSON.parse(result.stdout)).toBeArray();
  });

  it("prints the rewrite once, and a second run finds a current file and prints nothing", async () => {
    const { file } = project(OLD, true);
    const first = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV });
    const second = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV });

    expect(first.stderr.match(/git checkout/g)).toHaveLength(1);
    expect(second.stderr).not.toContain("git checkout");
    expect(second.stderr).not.toContain("variant.instances");
  });

  it("rewrites an untracked file after saving a backup, and says where the old text is", async () => {
    const { file } = project(OLD, false);

    const result = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV });

    expect(result.exitCode).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(NEW);
    expect(readFileSync(`${file}~`, "utf8")).toBe(OLD);
    expect(result.stderr).toContain(file);
    expect(result.stderr).toContain("not tracked");
    expect(result.stderr).toContain(`${file}~`);
    expect(result.stderr).toContain("variant.watches");
    expect(result.stderr).not.toContain("git checkout");
    expect(JSON.parse(result.stdout)).toBeArray();
  });

  it("names the reason when it does not rewrite, and the command still runs", async () => {
    const { file } = project(OLD, true);
    writeFileSync(file, `${OLD}# my edit\n`);

    const result = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV });

    expect(result.exitCode).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(`${OLD}# my edit\n`);
    expect(result.stderr).toContain(file);
    expect(result.stderr).toContain("uncommitted");
    expect(result.stderr).toContain("variant.watches");
    expect(JSON.parse(result.stdout)).toBeArray();
  });

  it("does not rewrite when CI is set, and names CI", async () => {
    const { file } = project(OLD, true);

    const result = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV, CI: "true" });

    expect(readFileSync(file, "utf8")).toBe(OLD);
    expect(result.stderr).toContain("CI");
    expect(result.exitCode).toBe(0);
  });

  it("does not rewrite when VARIANT_MIGRATE is 0, and names it", async () => {
    const { file } = project(OLD, true);

    const result = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV, VARIANT_MIGRATE: "0" });

    expect(readFileSync(file, "utf8")).toBe(OLD);
    expect(result.stderr).toContain("VARIANT_MIGRATE=0");
  });

  it("does not rewrite a variants.local.yaml that uses runtime.instances", async () => {
    const { directory, file } = project(NEW, true);
    const local = join(directory, "variants.local.yaml");
    const text = `${LOCAL_HEADER}\n\nruntime:\n  slug: main\n  instances:\n    be: { port: 62060 }\n`;
    writeFileSync(local, text);

    const result = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV });

    expect({
      exitCode: result.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
      text: readFileSync(local, "utf8"),
    }).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: expect.any(String),
      text,
    });
    expect(readFileSync(local, "utf8")).toBe(text);
    expect(result.stderr).not.toContain(local);
  });

  it("rewrites the git-ignored variants.local.yaml next to it", async () => {
    const { directory, file } = project(NEW, true);
    const local = join(directory, "variants.local.yaml");
    writeFileSync(local, `${LOCAL_HEADER}\n\nruntime:\n  slug: main\n  instances:\n    be: { port: 62060 }\n`);

    const result = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV });

    expect(readFileSync(local, "utf8")).toBe(
      `${LOCAL_HEADER}\n\nruntime:\n  slug: main\n  watches:\n    be: { port: 62060 }\n`,
    );
    expect(result.stderr).toContain(local);
    expect(result.stderr).not.toContain(`git checkout -- ${local}`);
  });

  it("prints nothing about migration for a current file", async () => {
    const { file } = project(NEW, true);

    const result = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV });

    expect(result.stderr).toBe("");
  });

  it("reports a file that stays old once per process", () => {
    const { directory, file } = project(OLD, true);
    const config = loadConfig({ cwd: directory, configPath: file, env: {} });
    const lines: string[] = [];

    migrateConfigFiles(config, { CI: "true" }, (line) => lines.push(line));
    migrateConfigFiles(config, { CI: "true" }, (line) => lines.push(line));

    expect(lines.filter((line) => line.startsWith("warning:"))).toHaveLength(1);
  });
});

describe("the schema header in the CLI", () => {
  it("adds the header to a current file that has none, and says so", async () => {
    const { file } = project(BARE_NEW, true);

    const result = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV });

    expect(result.exitCode).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(NEW);
    expect(result.stderr).toContain(file);
    expect(result.stderr).toContain("schema header");
    expect(result.stderr).toContain(`git checkout -- ${file}`);
  });

  it("saves a backup when it adds the header to an untracked file", async () => {
    const { file } = project(BARE_NEW, false);

    await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV });

    expect(readFileSync(file, "utf8")).toBe(NEW);
    expect(readFileSync(`${file}~`, "utf8")).toBe(BARE_NEW);
  });

  it("stays silent when the header cannot be added, because it is only cosmetic", async () => {
    const { file } = project(BARE_NEW, true);

    const result = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV, CI: "true" });

    expect(readFileSync(file, "utf8")).toBe(BARE_NEW);
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("still reports a skipped rename of old names, header or not", async () => {
    const { file } = project(BARE_OLD, true);

    const result = await runCli(["list", "--json"], { VARIANT_CONFIG: file, ...ENV, CI: "true" });

    expect(result.stderr).toContain("variant.watches");
    expect(result.stderr).toContain("CI");
  });
});
