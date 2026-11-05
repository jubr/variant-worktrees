import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/index.js";

const tempDirectory = (): string => realpathSync(mkdtempSync(join("/tmp", "variant-worktree-file-")));

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

const initRepo = (repo: string): void => {
  execFileSync("git", ["init", "-q", "-b", "main", repo], { encoding: "utf8" });
  git(repo, "config", "user.email", "variant@example.test");
  git(repo, "config", "user.name", "Variant Tests");
  writeFileSync(join(repo, "AGENTS.md"), "# main\n");
  writeFileSync(join(repo, "variants.yaml"), "variant: {}\n");
  git(repo, "add", "AGENTS.md", "variants.yaml");
  git(repo, "commit", "-q", "-m", "initial");
};

const withDirectory = (run: (directory: string) => void): void => {
  const directory = tempDirectory();
  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const WORKTREE_FILE = `variant:
  watches:
    api:
      watch: task api:dev
    spa:
      watch: task app:dev -- --port "$VARIANT_SPA_PORT"
`;

describe("worktree configuration file", () => {
  it("loads the worktree file, and keeps the primary checkout as main and the symlink directory as root", () =>
    withDirectory((directory) => {
      const workspace = join(directory, "work");
      const main = join(workspace, "app");
      const linked = join(workspace, "_v-demo");
      mkdirSync(main, { recursive: true });
      initRepo(main);
      symlinkSync(join(main, "AGENTS.md"), join(workspace, "AGENTS.md"));
      git(main, "worktree", "add", "-q", "-b", "feat/demo", linked, "main");
      writeFileSync(join(linked, "variants.yaml"), WORKTREE_FILE);

      const loaded = loadConfig({ cwd: linked, environment: () => ({}) });

      expect(loaded.configPath).toBe(join(linked, "variants.yaml"));
      expect(Object.keys(loaded.variant.watches)).toEqual(["api", "spa"]);
      expect(loaded.variant.watches.api?.watch).toBe("task api:dev");
      expect(loaded.variant.main).toBe(main);
      expect(loaded.variant.root).toBe(workspace);
    }));

  it("loads the worktree file from a subdirectory and ignores a parent variants.yaml", () =>
    withDirectory((directory) => {
      const workspace = join(directory, "work");
      const main = join(workspace, "app");
      const linked = join(workspace, "_v-demo");
      mkdirSync(main, { recursive: true });
      initRepo(main);
      symlinkSync(join(main, "AGENTS.md"), join(workspace, "AGENTS.md"));
      writeFileSync(join(workspace, "variants.yaml"), "variant:\n  watches:\n    other:\n      watch: bun run dev\n");
      git(main, "worktree", "add", "-q", "-b", "feat/demo", linked, "main");
      writeFileSync(join(linked, "variants.yaml"), WORKTREE_FILE);
      mkdirSync(join(linked, "server"));

      const loaded = loadConfig({ cwd: join(linked, "server"), environment: () => ({}) });

      expect(loaded.configPath).toBe(join(linked, "variants.yaml"));
      expect(Object.keys(loaded.variant.watches)).toEqual(["api", "spa"]);
      expect(loaded.variant.main).toBe(main);
      expect(loaded.variant.root).toBe(workspace);
    }));

  it("keeps the AGENTS.md fallback when the worktree has no variants file", () =>
    withDirectory((directory) => {
      const workspace = join(directory, "work");
      const main = join(workspace, "app");
      const linked = join(workspace, "_v-demo");
      mkdirSync(main, { recursive: true });
      initRepo(main);
      symlinkSync(join(main, "AGENTS.md"), join(workspace, "AGENTS.md"));
      git(main, "worktree", "add", "-q", "-b", "feat/demo", linked, "main");
      rmSync(join(linked, "variants.yaml"));

      const loaded = loadConfig({ cwd: linked, environment: () => ({}) });

      expect(loaded.configPath).toBe(join(main, "variants.yaml"));
      expect(loaded.variant.main).toBe(main);
      expect(loaded.variant.root).toBe(workspace);
    }));
});

const dbFile = (port: string): string =>
  `db:\n  dialect: postgres\n  host: localhost\n  port: ${port}\n  database: app\n`;

describe("db.port", () => {
  it("resolves a digit string to the integer", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), dbFile('"5432"'));

      expect(loadConfig({ cwd: directory, environment: () => ({}) }).db.port).toBe(5432);
    }));

  it("resolves ${POSTGRES_PORT} to the integer", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), dbFile("${POSTGRES_PORT}"));

      const loaded = loadConfig({
        cwd: directory,
        environment: () => ({ POSTGRES_PORT: "5432" }),
      });

      expect(loaded.db.port).toBe(5432);
    }));

  it("rejects a port string that is not digits or a single variable", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), dbFile('"not-a-number"'));

      expect(() => loadConfig({ cwd: directory, environment: () => ({}) })).toThrow(/port/);
    }));

  it("accepts an integer or a string in the published JSON schema", () => {
    const schema = JSON.parse(readFileSync(new URL("../variants.yaml.schema.json", import.meta.url), "utf8")) as {
      properties: { db: { properties: { port: unknown } } };
    };
    const port = JSON.stringify(schema.properties.db.properties.port);

    expect(port).toContain("integer");
    expect(port).toContain("string");
  });
});
