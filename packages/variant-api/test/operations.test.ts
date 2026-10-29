import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

      expect(await client.implode("test-feature")).toMatchObject({
        slug: "test-feature",
        removed: true,
        worktreeRemoved: false,
      });
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

  it("creates a worktree without changing the working directory of the process", async () => {
    const parent = tempDirectory();
    const repo = join(parent, "repo");
    const originalDirectory = process.cwd();
    try {
      const git = (...args: string[]): void => {
        execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" });
      };
      execFileSync("git", ["init", "-q", "-b", "main", repo], { encoding: "utf8" });
      git("config", "user.email", "variant@example.test");
      git("config", "user.name", "Variant Tests");
      writeFileSync(join(repo, "README.md"), "test\n");
      git("add", "README.md");
      git("commit", "-q", "-m", "initial");

      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
      });
      const created = await client.create("add-auth");

      expect(created.worktree).toContain("_v-add-auth");
      expect(existsSync(created.worktree as string)).toBe(true);
      expect(process.cwd()).toBe(originalDirectory);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
