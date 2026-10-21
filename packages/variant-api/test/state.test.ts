import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { migrateJsonStates, readState, statePath, writeState } from "../src/state.js";

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-state-"));

describe("variant state", () => {
  it("writes yq-compatible YAML state", () => {
    const directory = tempDirectory();
    try {
      const path = writeState(directory, {
        slug: "test-feature",
        target: "v_test_feature",
        dialect: "postgres",
        statePath: statePath(directory, "test-feature"),
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      expect(readFileSync(path, "utf8")).toContain("slug: test-feature");
      expect(readState(directory, "test-feature")?.target).toBe("v_test_feature");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("converts legacy JSON state to YAML", () => {
    const directory = tempDirectory();
    try {
      const jsonPath = join(directory, "test-feature.json");
      writeFileSync(jsonPath, JSON.stringify({ slug: "test-feature", target: "v_test_feature" }));
      migrateJsonStates(directory);
      expect(existsSync(jsonPath)).toBe(false);
      expect(existsSync(join(directory, "test-feature.yaml"))).toBe(true);
      expect(readState(directory, "test-feature")?.target).toBe("v_test_feature");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
