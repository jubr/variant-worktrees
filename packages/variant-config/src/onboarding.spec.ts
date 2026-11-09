import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { detectOnboarding, detectScriptWatches, detectWatchesForInit } from "./autodetect.js";

/**
 * Specification: openspec/specs/variant-api/init/spec.md (Script watches),
 * openspec/specs/variant-vscode/onboarding/spec.md (One-time onboarding notification)
 */

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join("/tmp", "variant-onboarding-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

const put = (path: string, content = ""): void => {
  mkdirSync(dirname(join(directory, path)), { recursive: true });
  writeFileSync(join(directory, path), content);
};
const pkg = (scripts: Record<string, string>, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ name: "x", scripts, ...extra });

describe("detectScriptWatches", () => {
  it("runs a watch script through npm without a lockfile and sets no kind", () => {
    put("api/package.json", pkg({ build: "tsc", watch: "tsc -w" }));

    expect(detectScriptWatches(directory)).toEqual({ api: { dir: "api", watch: "npm run watch" } });
  });

  it("takes the first watch-like script in file order", () => {
    put("api/package.json", pkg({ build: "x", "build:watch": "tsc -w", watch: "y" }));

    expect(detectScriptWatches(directory).api?.watch).toBe("npm run build:watch");
  });

  it("matches a segment split on : - _ and .", () => {
    put("a/package.json", pkg({ "dev-watch": "x" }));
    put("b/package.json", pkg({ watch_all: "x" }));
    put("c/package.json", pkg({ "ts.watch": "x" }));
    put("d/package.json", pkg({ watcher: "x", rewatch: "x" }));

    expect(Object.keys(detectScriptWatches(directory))).toEqual(["a", "b", "c"]);
  });

  it("takes the package manager from the lockfile in the directory", () => {
    put("a/package.json", pkg({ watch: "x" }));
    put("a/bun.lock");
    put("b/package.json", pkg({ watch: "x" }));
    put("b/pnpm-lock.yaml");
    put("c/package.json", pkg({ watch: "x" }));
    put("c/yarn.lock");
    put("d/package.json", pkg({ watch: "x" }));
    put("d/bun.lockb");

    const watches = detectScriptWatches(directory);

    expect(watches.a?.watch).toBe("bun run watch");
    expect(watches.b?.watch).toBe("pnpm run watch");
    expect(watches.c?.watch).toBe("yarn run watch");
    expect(watches.d?.watch).toBe("bun run watch");
  });

  it("falls back to the lockfile of the project directory", () => {
    put("pnpm-lock.yaml");
    put("api/package.json", pkg({ watch: "x" }));

    expect(detectScriptWatches(directory).api?.watch).toBe("pnpm run watch");
  });

  it("leaves a Vite or NestJS directory to its own watch", () => {
    put("fe/package.json", pkg({ watch: "x" }, { devDependencies: { vite: "1" } }));
    put("be/package.json", pkg({ watch: "x" }, { dependencies: { "@nestjs/core": "1" } }));
    put("lib/package.json", pkg({ watch: "x" }));

    expect(Object.keys(detectScriptWatches(directory))).toEqual(["lib"]);
  });

  it("detects the project directory itself as app with dir .", () => {
    put("package.json", pkg({ watch: "x" }));

    expect(detectScriptWatches(directory)).toEqual({ app: { dir: ".", watch: "npm run watch" } });
  });

  it("skips node_modules and dot directories", () => {
    put("node_modules/dep/package.json", pkg({ watch: "x" }));
    put(".hidden/package.json", pkg({ watch: "x" }));

    expect(detectScriptWatches(directory)).toEqual({});
  });

  it("ignores a package.json without a watch-like script or that is invalid", () => {
    put("a/package.json", pkg({ build: "x" }));
    put("b/package.json", "{ not json");

    expect(detectScriptWatches(directory)).toEqual({});
  });
});

describe("detectWatchesForInit", () => {
  it("lists Vite, NestJS and script watches by directory with unique keys", () => {
    put("fe/vite.config.ts", "export default {};\n");
    put("be/nest-cli.json", "{}\n");
    put("a/web/package.json", pkg({ watch: "x" }));
    put("b/web/package.json", pkg({ watch: "x" }));

    const watches = detectWatchesForInit(directory);

    expect(Object.keys(watches)).toEqual(["web", "web-2", "be", "fe"]);
    expect(watches.web).toEqual({ dir: "a/web", watch: "npm run watch" });
    expect(watches["web-2"]).toEqual({ dir: "b/web", watch: "npm run watch" });
    expect(watches.fe?.kind).toBe("vite");
    expect(watches.be?.kind).toBe("nestjs");
  });
});

describe("detectOnboarding", () => {
  it("names a detected database and the application kinds in order", () => {
    put("fe/vite.config.ts", "export default {};\n");
    put("be/nest-cli.json", "{}\n");
    put("lib/package.json", pkg({ watch: "x" }));

    const detected = detectOnboarding(directory, () => ({ POSTGRES_HOST: "h" }));

    expect(detected).toMatchObject({
      database: "postgres",
      applications: ["vite", "nestjs", "package-script-watch"],
      label: "postgres+vite+nestjs+package-script-watch",
    });
  });

  it("names mysql, mariadb and sqlite", () => {
    put("fe/vite.config.ts", "export default {};\n");

    expect(detectOnboarding(directory, () => ({ MYSQL_HOST: "h" })).label).toBe("mysql+vite");
    expect(detectOnboarding(directory, () => ({ MARIADB_HOST: "h" })).label).toBe("mariadb+vite");
    expect(detectOnboarding(directory, () => ({ DATABASE_URL: "mariadb://a@h/d" })).label).toBe("mariadb+vite");
    expect(detectOnboarding(directory, () => ({ DATABASE_URL: "mysql://a@h/d" })).label).toBe("mysql+vite");
    expect(detectOnboarding(directory, () => ({ SQLITE_DATABASE: "x" })).label).toBe("sqlite+vite");
  });

  it("does not count the SQLite fallback as a database", () => {
    put("fe/vite.config.ts", "export default {};\n");

    expect(detectOnboarding(directory, () => ({}))).toMatchObject({ database: undefined, label: undefined });
  });

  it("has no label without an application", () => {
    expect(detectOnboarding(directory, () => ({ POSTGRES_HOST: "h" }))).toMatchObject({
      applications: [],
      label: undefined,
    });
  });

  it("treats a failing environment as nothing detected and returns the error", () => {
    put("fe/vite.config.ts", "export default {};\n");
    const failure = new Error("mise failed");

    const detected = detectOnboarding(directory, () => {
      throw failure;
    });

    expect(detected).toMatchObject({ database: undefined, applications: [], label: undefined, error: failure });
  });

  it("does not call the environment when there is no application", () => {
    let calls = 0;

    detectOnboarding(directory, () => {
      calls += 1;
      return {};
    });

    expect(calls).toBe(0);
  });
});
