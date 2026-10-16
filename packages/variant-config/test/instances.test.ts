import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectInstances } from "../src/autodetect.js";
import { loadConfig } from "../src/index.js";
import { DEFAULT_OPEN_URL } from "../src/schema.js";

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-instances-"));

describe("runtime instance discovery", () => {
  it("detects Vite and NestJS applications below the config directory", () => {
    const directory = tempDirectory();
    try {
      mkdirSync(join(directory, "app"), { recursive: true });
      mkdirSync(join(directory, "server"), { recursive: true });
      writeFileSync(join(directory, "app", "vite.config.ts"), "export default {};\n");
      writeFileSync(join(directory, "server", "nest-cli.json"), "{}\n");

      const instances = detectInstances(directory);

      expect(instances).toEqual({
        app: { kind: "vite", dir: "app", open: DEFAULT_OPEN_URL, watch: "bunx --bun vite --clearScreen false" },
        server: { kind: "nestjs", dir: "server", watch: "bunx nest start --watch --preserveWatchOutput" },
      });
      expect(Object.keys(instances)).toEqual(["app", "server"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses explicit instances instead of filesystem autodetection", () => {
    const directory = tempDirectory();
    try {
      mkdirSync(join(directory, "autodetected"), { recursive: true });
      writeFileSync(join(directory, "autodetected", "vite.config.ts"), "export default {};\n");
      writeFileSync(
        join(directory, "variants.yaml"),
        "variant:\n  instances:\n    app:\n      kind: vite\n      dir: configured-app\n",
      );

      expect(loadConfig({ cwd: directory }).variant?.instances).toEqual({
        app: { kind: "vite", dir: "configured-app" },
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
      return Object.values(detectInstances(directory))[0]?.watch;
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
});
