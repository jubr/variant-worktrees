import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"));

describe("extension manifest", () => {
  it("contributes the three settings the trigger reads", () => {
    expect(Object.keys(manifest.contributes.configuration.properties).sort()).toEqual([
      "chat-renamer.activationPatterns",
      "chat-renamer.hookScope",
      "chat-renamer.trigger",
    ]);
  });

  it("activates on startup and on its URI", () => {
    expect(manifest.activationEvents).toEqual(["onStartupFinished", "onUri"]);
  });

  it("keeps the default activation pattern in step with the api package", async () => {
    const { DEFAULT_ACTIVATION_PATTERNS } = await import("chat-renamer-api");

    expect(manifest.contributes.configuration.properties["chat-renamer.activationPatterns"].default).toEqual([
      ...DEFAULT_ACTIVATION_PATTERNS,
    ]);
  });

  it("ships the files a Marketplace package needs", () => {
    for (const file of ["LICENSE.txt", "README.md", ".vscodeignore"]) {
      expect(existsSync(join(import.meta.dir, "..", file))).toBe(true);
    }
  });
});
