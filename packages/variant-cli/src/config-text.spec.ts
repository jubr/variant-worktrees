import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { type CliResult, runCommand } from "./test/cli.js";

/** Specification: openspec/specs/variant-config/core/spec.md (Config CLI command) */

const cli = join(import.meta.dir, "cli.ts");

const QUIET_DB = [
  "DATABASE_URL",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  "POSTGRES_SCHEMA",
  "POSTGRES_SSL",
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
  "MYSQL_SCHEMA",
  "MARIADB_HOST",
  "MARIADB_PORT",
  "MARIADB_USER",
  "MARIADB_PASSWORD",
  "MARIADB_DATABASE",
  "SQLITE_DATABASE",
  "SQLITE_PATH",
  "VARIANT_OPEN",
  "VARIANT_SEED",
];

const quiet = (extra: Record<string, string> = {}): Record<string, string> => ({
  ...Object.fromEntries(QUIET_DB.map((name) => [name, ""])),
  ...extra,
});

const config = async (directory: string, args: string[], env: Record<string, string> = {}): Promise<CliResult> =>
  runCommand(["bun", cli], args, quiet(env), directory);

const withProject = async (
  yaml: string,
  run: (directory: string) => Promise<void>,
  files: Record<string, string> = {},
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-config-text-")));
  try {
    writeFileSync(join(directory, "variants.yaml"), yaml);
    for (const [path, content] of Object.entries(files)) {
      const file = join(directory, path);
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, content);
    }
    await run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

/** True when `key`'s line, or an ancestor line, carries `comment`. */
const commentCovers = (stdout: string, key: string, comment: string): boolean => {
  const lines = stdout.split("\n");
  const index = lines.findIndex((line) => new RegExp(`^\\s*${key}:`).test(line));
  if (index < 0) {
    return false;
  }
  let indent = lines[index]?.match(/^ */)?.[0].length ?? 0;
  if (lines[index]?.includes(comment)) {
    return true;
  }
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const line = lines[cursor] ?? "";
    const lineIndent = line.match(/^ */)?.[0].length ?? 0;
    if (lineIndent < indent && line.includes(":")) {
      if (line.includes(comment)) {
        return true;
      }
      indent = lineIndent;
    }
  }
  return false;
};

const line = (stdout: string, key: string): string =>
  stdout.split("\n").find((item) => new RegExp(`^\\s*${key}:`).test(item)) ?? "";

const hasOrigin = (text: string): boolean => /# (from |default|autodetect )/.test(text);

describe("config text origins", () => {
  it("comments a default prefix and a host from POSTGRES_HOST", () =>
    withProject("variant: {}\n", async (directory) => {
      const result = await config(directory, ["config"], { POSTGRES_HOST: "db.example" });

      expect(result.exitCode).toBe(0);
      expect(line(result.stdout, "prefix")).toContain("_v-");
      expect(commentCovers(result.stdout, "prefix", "# default")).toBe(true);
      expect(line(result.stdout, "host")).toContain("db.example");
      expect(line(result.stdout, "host")).toContain("# from env POSTGRES_HOST");
    }));

  it("comments a main-file prefix on variant and leaves the prefix line bare", () =>
    withProject("variant:\n  prefix: _work-\n", async (directory) => {
      const result = await config(directory, ["config"]);

      expect(result.exitCode).toBe(0);
      expect(line(result.stdout, "variant")).toContain("# from ./variants.yaml");
      expect(line(result.stdout, "prefix")).toContain("_work-");
      expect(hasOrigin(line(result.stdout, "prefix"))).toBe(false);
    }));

  it("comments a worktree file and does not print the main prefix", () =>
    withProject("variant:\n  prefix: _main-\n", async (directory) => {
      const linked = join(directory, "_v-demo");
      mkdirSync(linked);
      writeFileSync(join(linked, "variants.yaml"), "variant:\n  prefix: _wt-\n");

      const result = await config(linked, ["config"]);

      expect(result.exitCode).toBe(0);
      expect(line(result.stdout, "variant")).toContain("# from ./variants.yaml");
      expect(line(result.stdout, "prefix")).toContain("_wt-");
      expect(hasOrigin(line(result.stdout, "prefix"))).toBe(false);
      expect(result.stdout).not.toContain("_main-");
    }));

  it("comments a parent file as # from ../variants.yaml", () =>
    withProject("variant:\n  prefix: _main-\n", async (directory) => {
      const linked = join(directory, "_v-demo");
      mkdirSync(linked);

      const result = await config(linked, ["config"]);

      expect(result.exitCode).toBe(0);
      expect(line(result.stdout, "prefix")).toContain("_main-");
      expect(commentCovers(result.stdout, "prefix", "# from ../variants.yaml")).toBe(true);
    }));

  it("comments chatRenamer on the parent when every child is from the file", () =>
    withProject("chatRenamer:\n  trigger: hook\n  renameExistingDays: 30\n", async (directory) => {
      const result = await config(directory, ["config"]);

      expect(result.exitCode).toBe(0);
      expect(line(result.stdout, "chatRenamer")).toContain("# from ./variants.yaml");
      expect(hasOrigin(line(result.stdout, "trigger"))).toBe(false);
      expect(hasOrigin(line(result.stdout, "renameExistingDays"))).toBe(false);
    }));

  it("comments a ${VARIANT_SEED} on seed and leaves a literal prefix bare", () =>
    withProject("variant:\n  prefix: _work-\n  seed: ${VARIANT_SEED}\n", async (directory) => {
      const result = await config(directory, ["config"], { VARIANT_SEED: "echo ok" });

      expect(result.exitCode).toBe(0);
      expect(line(result.stdout, "variant")).toContain("# from ./variants.yaml");
      expect(hasOrigin(line(result.stdout, "prefix"))).toBe(false);
      expect(line(result.stdout, "seed")).toContain("# from env VARIANT_SEED");
    }));

  it("comments a discovered Vite watch and leaves its children bare", () =>
    withProject("variant: {}\n", async (directory) => {
      mkdirSync(join(directory, "app"));
      writeFileSync(join(directory, "app", "vite.config.ts"), "export default {};\n");

      const result = await config(directory, ["config"]);

      expect(result.exitCode).toBe(0);
      expect(commentCovers(result.stdout, "app", "# autodetect watch")).toBe(true);
      expect(hasOrigin(line(result.stdout, "kind"))).toBe(false);
    }));

  it("comments omitted main and root, and --json still has both paths", () =>
    withProject("variant: {}\n", async (directory) => {
      const text = await config(directory, ["config"]);
      const json = await config(directory, ["config", "--json"]);

      expect(text.exitCode).toBe(0);
      expect(line(text.stdout, "main")).toContain("# autodetect main");
      expect(line(text.stdout, "root")).toContain("# autodetect root");
      const parsed = JSON.parse(json.stdout) as { variant: { main: string; root: string } };
      expect(parsed.variant.main).toBe(directory);
      expect(parsed.variant.root).toBe(directory);
    }));

  it("comments a ${POSTGRES_HOST} in the file as # from env POSTGRES_HOST", () =>
    withProject("db:\n  host: ${POSTGRES_HOST}\n", async (directory) => {
      const result = await config(directory, ["config"], { POSTGRES_HOST: "db.example" });

      expect(result.exitCode).toBe(0);
      expect(line(result.stdout, "host")).toContain("db.example");
      expect(line(result.stdout, "host")).toContain("# from env POSTGRES_HOST");
    }));

  it("comments an unset ${DB_HOST:-127.0.0.1} as the file", () =>
    withProject("db:\n  host: ${DB_HOST:-127.0.0.1}\n", async (directory) => {
      const result = await config(directory, ["config"]);

      expect(result.exitCode).toBe(0);
      expect(line(result.stdout, "host")).toContain("127.0.0.1");
      expect(commentCovers(result.stdout, "host", "# from ./variants.yaml")).toBe(true);
      expect(line(result.stdout, "host")).not.toContain("# from env");
    }));

  it("parses to the same value as --json once comments are ignored", () =>
    withProject("variant:\n  prefix: _work-\n", async (directory) => {
      const text = await config(directory, ["config"], { POSTGRES_HOST: "db.example" });
      const json = await config(directory, ["config", "--json"], { POSTGRES_HOST: "db.example" });

      expect(text.exitCode).toBe(0);
      expect(parseYaml(text.stdout)).toEqual(JSON.parse(json.stdout));
    }));

  it("prints --json and --yaml with no origin comment", () =>
    withProject("variant:\n  prefix: _work-\n", async (directory) => {
      const json = await config(directory, ["config", "--json"]);
      const yaml = await config(directory, ["config", "--yaml"]);

      expect(json.exitCode).toBe(0);
      expect(yaml.exitCode).toBe(0);
      expect(hasOrigin(json.stdout)).toBe(false);
      expect(hasOrigin(yaml.stdout)).toBe(false);
    }));

  it("redacts a file password and still names the file", () =>
    withProject("db:\n  dialect: postgres\n  host: db.example\n  password: hunter2\n", async (directory) => {
      for (const args of [["config"], ["config", "--json"], ["config", "--yaml"]]) {
        const result = await config(directory, args);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain("hunter2");
        expect(result.stdout).toContain("***");
      }
      const text = await config(directory, ["config"]);
      expect(commentCovers(text.stdout, "password", "# from ./variants.yaml")).toBe(true);
    }));

  it("redacts POSTGRES_PASSWORD and comments # from env POSTGRES_PASSWORD", () =>
    withProject("variant: {}\n", async (directory) => {
      const env = { POSTGRES_HOST: "db.example", POSTGRES_PASSWORD: "hunter2" };
      for (const args of [["config"], ["config", "--json"], ["config", "--yaml"]]) {
        const result = await config(directory, args, env);
        expect(result.stdout).not.toContain("hunter2");
        expect(result.stdout).toContain("***");
      }
      const text = await config(directory, ["config"], env);
      expect(line(text.stdout, "password")).toContain("# from env POSTGRES_PASSWORD");
    }));

  it("prints comments and no color when stdout is a pipe", () =>
    withProject("variant:\n  prefix: _work-\n", async (directory) => {
      const { FORCE_COLOR: _color, NO_COLOR: _noColor, ...inherited } = process.env;
      const proc = Bun.spawn(["bun", cli, "config"], {
        cwd: directory,
        env: { ...inherited, VARIANT_WORKTREE: "0" },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [exitCode, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("# from ./variants.yaml");
      expect(stdout).not.toContain("\u001b");
    }));

  it("exits 1 with the validation error when variants.yaml is invalid", () =>
    withProject("db:\n  dialect: not-a-dialect\n", async (directory) => {
      const result = await config(directory, ["config"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
      expect(result.stdout).toBe("");
    }));
});
