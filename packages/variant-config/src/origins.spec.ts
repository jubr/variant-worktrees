import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { configOrigins, loadConfig } from "./index.js";

/** Specification: openspec/specs/variant-config/core/spec.md */

const tempDirectory = (): string => realpathSync(mkdtempSync(join("/tmp", "variant-origins-")));

const withDirectory = (run: (directory: string) => void): void => {
  const directory = tempDirectory();
  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("config origins", () => {
  it("names a literal in the cwd file as # from ./variants.yaml", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");

      const config = loadConfig({ cwd: directory, environment: () => ({}) });

      expect(Object.keys(config)).not.toContain("origins");
      expect(configOrigins(config)["variant.prefix"]).toBe("# from ./variants.yaml");
    }));

  it("names a parent file as # from ../variants.yaml when cwd is a child directory", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");
      const child = join(directory, "child");
      mkdirSync(child);

      const config = loadConfig({ cwd: child, environment: () => ({}) });

      expect(configOrigins(config)["variant.prefix"]).toBe("# from ../variants.yaml");
    }));

  it("names an omitted abbr from the main directory name", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");

      const config = loadConfig({ cwd: directory, environment: () => ({}) });

      expect(configOrigins(config)["variant.abbr"]).toBe(`# autodetect from "${basename(directory)}"`);
    }));

  it("does not comment runtime", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant: {}\n");
      mkdirSync(join(directory, ".cache", "variant"), { recursive: true });
      writeFileSync(join(directory, ".cache", "variant", "state.yaml"), "slug: demo\nmode: watch\n");

      const config = loadConfig({ cwd: directory, environment: () => ({}) });

      expect(config.runtime?.slug).toBe("demo");
      expect(configOrigins(config).runtime).toBeUndefined();
    }));

  it("names a file array item as the file, not # default", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  implode:\n    preRm: [dist, node_modules]\n");

      const config = loadConfig({ cwd: directory, environment: () => ({}) });

      expect(configOrigins(config)["variant.implode.preRm.0"]).toBe("# from ./variants.yaml");
      expect(configOrigins(config)["variant.implode.preRm.1"]).toBe("# from ./variants.yaml");
    }));

  it("names an omitted prefix as # default", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  seed: ./seed.sh\n");

      const config = loadConfig({ cwd: directory, environment: () => ({}) });

      expect(config.variant.prefix).toBe("_v-");
      expect(configOrigins(config)["variant.prefix"]).toBe("# default");
    }));

  it("names main from git rev-parse when the common dir decides it", () =>
    withDirectory((directory) => {
      execFileSync("git", ["init"], { cwd: directory });
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");

      const config = loadConfig({ cwd: directory, environment: () => ({}) });

      expect(config.variant.main).toBe(directory);
      expect(configOrigins(config)["variant.main"]).toBe("# autodetect from `git rev-parse --git-common-dir`");
    }));

  it("leaves main and root uncommented when the path is only the config directory", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");

      const config = loadConfig({ cwd: directory, environment: () => ({}) });

      expect(config.variant.main).toBe(directory);
      expect(config.variant.root).toBe(directory);
      expect(configOrigins(config)["variant.main"]).toBeUndefined();
      expect(configOrigins(config)["variant.root"]).toBeUndefined();
    }));

  it("names a discovered Vite watch as # autodetect watch", () =>
    withDirectory((directory) => {
      mkdirSync(join(directory, "app"));
      writeFileSync(join(directory, "app", "vite.config.ts"), "export default {};\n");
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");

      const config = loadConfig({ cwd: directory, environment: () => ({}) });

      expect(config.variant.watches.app?.kind).toBe("vite");
      expect(configOrigins(config)["variant.watches.app"]).toBe("# autodetect watch");
      expect(configOrigins(config)["variant.watches.app.kind"]).toBe("# autodetect watch");
    }));

  it("names db.host from POSTGRES_HOST as # from env POSTGRES_HOST", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");

      const config = loadConfig({
        cwd: directory,
        environment: () => ({ POSTGRES_HOST: "db.example" }),
      });

      expect(config.db.host).toBe("db.example");
      expect(configOrigins(config)["db.host"]).toBe("# from env POSTGRES_HOST");
      expect(configOrigins(config)["db.dialect"]).toBe("# from env POSTGRES_HOST");
    }));

  it("names a ${POSTGRES_HOST} written in the file as # from env POSTGRES_HOST", () =>
    withDirectory((directory) => {
      writeFileSync(
        join(directory, "variants.yaml"),
        "db:\n  dialect: postgres\n  host: ${POSTGRES_HOST}\n  user: app\n  database: app\n",
      );

      const config = loadConfig({
        cwd: directory,
        environment: () => ({ POSTGRES_HOST: "db.example" }),
      });

      expect(config.db.host).toBe("db.example");
      expect(configOrigins(config)["db.host"]).toBe("# from env POSTGRES_HOST");
    }));

  it("names an unset ${DB_HOST:-127.0.0.1} as the file", () =>
    withDirectory((directory) => {
      writeFileSync(
        join(directory, "variants.yaml"),
        "db:\n  dialect: postgres\n  host: ${DB_HOST:-127.0.0.1}\n  user: app\n  database: app\n",
      );

      const config = loadConfig({ cwd: directory, environment: () => ({}) });

      expect(config.db.host).toBe("127.0.0.1");
      expect(configOrigins(config)["db.host"]).toBe("# from ./variants.yaml");
    }));

  it("names a detected database field with no variable as # autodetect connection", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");

      const config = loadConfig({
        cwd: directory,
        environment: () => ({ POSTGRES_HOST: "db.example" }),
      });

      expect(config.db.url).toBeUndefined();
      expect(configOrigins(config)["db.url"]).toBe("# autodetect connection");
    }));

  it("names the sqlite fallback as # default", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");

      const config = loadConfig({ cwd: directory, environment: () => ({}) });

      expect(config.db.dialect).toBe("sqlite");
      expect(configOrigins(config)["db.dialect"]).toBe("# default");
      expect(configOrigins(config)["db.filename"]).toBe("# default");
    }));

  it("names a worktree file literal as # from ./variants.yaml and ignores the main prefix", () =>
    withDirectory((directory) => {
      const main = join(directory, "main");
      const linked = join(directory, "_v-demo");
      mkdirSync(main);
      execFileSync("git", ["init", "-q", "-b", "main", main]);
      execFileSync("git", ["-C", main, "config", "user.email", "variant@example.test"]);
      execFileSync("git", ["-C", main, "config", "user.name", "Variant Tests"]);
      writeFileSync(join(main, "variants.yaml"), "variant:\n  prefix: _main-\n");
      writeFileSync(join(main, "AGENTS.md"), "# main\n");
      execFileSync("git", ["-C", main, "add", "variants.yaml", "AGENTS.md"]);
      execFileSync("git", ["-C", main, "commit", "-q", "-m", "initial"]);
      execFileSync("git", ["-C", main, "worktree", "add", "-q", "-b", "feat/demo", linked, "main"]);
      writeFileSync(join(linked, "variants.yaml"), "variant:\n  prefix: _wt-\n");

      const config = loadConfig({ cwd: linked, environment: () => ({}) });

      expect(config.variant.prefix).toBe("_wt-");
      expect(configOrigins(config)["variant.prefix"]).toBe("# from ./variants.yaml");
    }));

  it("names every resolved path", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");

      const config = loadConfig({ cwd: directory, environment: () => ({}) });
      const origins = configOrigins(config);
      const missing: string[] = [];
      const walk = (value: unknown, path: string): void => {
        if (path !== "" && origins[path] === undefined) {
          missing.push(path);
        }
        if (typeof value !== "object" || value === null) {
          return;
        }
        for (const [key, child] of Object.entries(value)) {
          walk(child, path === "" ? key : `${path}.${key}`);
        }
      };
      walk(config, "");

      expect(missing).toEqual(["variant.main", "variant.root"]);
    }));
});
