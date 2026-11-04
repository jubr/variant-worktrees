import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectWatches } from "../src/autodetect.js";
import { loadConfig } from "../src/index.js";
import { DEFAULT_URL } from "../src/schema.js";

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-watches-"));

describe("runtime watch discovery", () => {
  it("gives a detected Vite watch the default template with the abbreviation placeholder", () => {
    expect(DEFAULT_URL).toBe("http://${slug}.${abbr}.localhost:${port}");
  });

  it("detects Vite and NestJS applications below the config directory", () => {
    const directory = tempDirectory();
    try {
      mkdirSync(join(directory, "app"), { recursive: true });
      mkdirSync(join(directory, "server"), { recursive: true });
      writeFileSync(join(directory, "app", "vite.config.ts"), "export default {};\n");
      writeFileSync(join(directory, "server", "nest-cli.json"), "{}\n");

      const watches = detectWatches(directory);

      expect(watches).toEqual({
        app: { kind: "vite", dir: "app", url: DEFAULT_URL, watch: "bunx --bun vite --clearScreen false" },
        server: { kind: "nestjs", dir: "server", watch: "bunx nest start --watch --preserveWatchOutput" },
      });
      expect(Object.keys(watches)).toEqual(["app", "server"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses explicit watches instead of filesystem autodetection", () => {
    const directory = tempDirectory();
    try {
      mkdirSync(join(directory, "autodetected"), { recursive: true });
      writeFileSync(join(directory, "autodetected", "vite.config.ts"), "export default {};\n");
      writeFileSync(
        join(directory, "variants.yaml"),
        "variant:\n  watches:\n    app:\n      kind: vite\n      dir: configured-app\n",
      );

      expect(loadConfig({ cwd: directory }).variant?.watches).toEqual({
        app: { kind: "vite", dir: "configured-app" },
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("a watch without kind", () => {
  it("loads with its commands and its key as directory", () => {
    const directory = tempDirectory();
    try {
      writeFileSync(
        join(directory, "variants.yaml"),
        "variant:\n  watches:\n    be:\n      watch: bun run start:dev\n    fe:\n      dir: web\n",
      );

      const config = loadConfig({ cwd: directory, env: {} });

      expect(config.warnings).toEqual([]);
      expect(config.variant.watches).toEqual({
        be: { dir: "be", watch: "bun run start:dev" },
        fe: { dir: "web" },
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("autodetected watch commands keep the console", () => {
  /** Detects the single application in `app/`, created from `files`, and returns its `watch` command. */
  const watchOf = (files: Record<string, string>): string | undefined => {
    const directory = tempDirectory();
    try {
      mkdirSync(join(directory, "app"), { recursive: true });
      for (const [name, content] of Object.entries(files)) {
        writeFileSync(join(directory, "app", name), content);
      }
      return Object.values(detectWatches(directory))[0]?.watch;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };
  const scripts = (entries: Record<string, string>): string => JSON.stringify({ scripts: entries });
  const NEST = { "nest-cli.json": "{}\n" };

  it("passes --clearScreen false to a Vite dev script", () =>
    expect(watchOf({ "vite.config.ts": "export default {};\n", "package.json": scripts({ dev: "vite" }) })).toBe(
      "bun run dev --clearScreen false",
    ));

  it("leaves a Vite configuration that sets clearScreen alone", () =>
    expect(
      watchOf({
        "vite.config.ts": "export default { clearScreen: false };\n",
        "package.json": scripts({ dev: "vite" }),
      }),
    ).toBe("bun run dev"));

  it("runs Vite itself without a dev script", () =>
    expect(watchOf({ "vite.config.ts": "export default { clearScreen: true };\n" })).toBe("bunx --bun vite"));

  it("passes --preserveWatchOutput to a Nest start script unless tsconfig sets it", () => {
    const withScript = { ...NEST, "package.json": scripts({ "start:dev": "nest start --watch" }) };

    expect(watchOf(withScript)).toBe("bun run start:dev --preserveWatchOutput");
    expect(watchOf({ ...withScript, "tsconfig.json": '{ "compilerOptions": { "preserveWatchOutput": true } }' })).toBe(
      "bun run start:dev",
    );
  });

  it("starts Nest itself without a start script", () =>
    expect(watchOf(NEST)).toBe("bunx nest start --watch --preserveWatchOutput"));

  it("puts --no-clear-screen into a Bun watch script", () =>
    expect(watchOf({ ...NEST, "package.json": scripts({ "start:dev": "bun --watch src/main.ts" }) })).toBe(
      "bun --watch --no-clear-screen src/main.ts",
    ));

  it("keeps a Bun watch script that already passes --no-clear-screen", () =>
    expect(
      watchOf({ ...NEST, "package.json": scripts({ "start:dev": "bun --watch --no-clear-screen src/main.ts" }) }),
    ).toBe("bun --watch --no-clear-screen src/main.ts"));
});
