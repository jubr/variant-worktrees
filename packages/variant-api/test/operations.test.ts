import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-operations-"));

describe("variant client operations", () => {
  it("creates, lists, and implodes an isolated SQLite variant", async () => {
    const directory = tempDirectory();
    try {
      const baseConfig = loadConfig({ cwd: directory });
      const config = {
        ...baseConfig,
        db: { dialect: "sqlite" as const },
      };
      const client = createClient({
        config,
        cwd: directory,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });

      const created = await client.create("test-feature");
      expect(created.slug).toBe("test-feature");
      expect(created.target).toBe(join(directory, ".cache", "variants", "test-feature.db"));
      expect((await client.list()).map((variant) => variant.slug)).toEqual(["test-feature"]);

      expect(await client.implode("test-feature")).toEqual({ slug: "test-feature", removed: true });
      expect(await client.list()).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("protects the main variant from implosion", async () => {
    const directory = tempDirectory();
    try {
      const baseConfig = loadConfig({ cwd: directory });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: directory,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });
      await expect(client.implode("main")).rejects.toThrow("Refusing to implode main");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("switches to the primary worktree for main", async () => {
    const directory = tempDirectory();
    const originalDirectory = process.cwd();
    try {
      const baseConfig = loadConfig({ cwd: directory });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: originalDirectory,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });
      const switched = await client.switch("main");
      expect(switched.slug).toBe("main");
      expect(switched.worktree).toContain("variant-worktrees");
    } finally {
      process.chdir(originalDirectory);
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
