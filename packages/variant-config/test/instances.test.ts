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

      expect(detectInstances(directory)).toEqual([
        { kind: "vite", dir: "app", open: DEFAULT_OPEN_URL },
        { kind: "nestjs", dir: "server" },
      ]);
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
        "variant:\n  instances:\n    - kind: vite\n      dir: configured-app\n",
      );

      expect(loadConfig({ cwd: directory }).variant?.instances).toEqual([{ kind: "vite", dir: "configured-app" }]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
