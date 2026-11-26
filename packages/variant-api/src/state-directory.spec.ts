import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createVariantClient } from "./index.js";

/** Specification: openspec/specs/variant-api/core/spec.md, "No empty state directory". */
describe("the state directory", () => {
  it("is not created by a command that writes nothing into it", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-state-dir-")));
    try {
      writeFileSync(
        join(directory, "variants.yaml"),
        `db:\n  dialect: sqlite\n  database: ${directory}/db/app.sqlite\n`,
      );
      const stateDir = join(directory, ".cache", "variants");
      const client = createVariantClient({
        config: loadConfig({ cwd: directory, env: {}, environment: () => ({}) }),
        cwd: directory,
        stateDir,
        worktree: false,
      });

      await client.list();

      expect(existsSync(stateDir)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("is left alone, with its legacy states still read, when it exists", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-state-dir-")));
    try {
      writeFileSync(
        join(directory, "variants.yaml"),
        `db:\n  dialect: sqlite\n  database: ${directory}/db/app.sqlite\n`,
      );
      const stateDir = join(directory, ".cache", "variants");
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(join(stateDir, "old.yaml"), "slug: old\n");
      const client = createVariantClient({
        config: loadConfig({ cwd: directory, env: {}, environment: () => ({}) }),
        cwd: directory,
        stateDir,
        worktree: false,
      });

      expect((await client.list()).map((record) => record.slug)).toContain("old");
      expect(existsSync(join(stateDir, "old.yaml"))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
