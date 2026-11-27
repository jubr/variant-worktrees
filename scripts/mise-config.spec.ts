/**
 * Specification: openspec/specs/meta/local-checks/spec.md (Mise minimum version)
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

type MiseConfig = { min_version?: string; tools?: Record<string, unknown> };

const config = Bun.TOML.parse(readFileSync(join(root, "mise.toml"), "utf8")) as MiseConfig;

/** The first Mise release with the `packslip:` backend (packslip compatibility page). */
const PACKSLIP_BACKEND_MISE = "2026.9.2";

/** Negative when `a` is older than `b`; both are dot-separated numbers such as `2026.9.2`. */
const compareVersions = (a: string, b: string): number => {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
};

describe("mise.toml minimum version", () => {
  test("a repository that installs a packslip: tool requires a Mise that has the backend", () => {
    const usesPackslip = Object.keys(config.tools ?? {}).some((name) => name.startsWith("packslip:"));
    expect(usesPackslip).toBe(true);
    expect(config.min_version).toBeString();
    expect(compareVersions(config.min_version ?? "0", PACKSLIP_BACKEND_MISE)).toBeGreaterThanOrEqual(0);
  });

  test("version comparison orders dotted numbers", () => {
    expect(compareVersions("2026.9.2", "2026.9.2")).toBe(0);
    expect(compareVersions("2026.9.10", "2026.9.2")).toBeGreaterThan(0);
    expect(compareVersions("2026.8.30", "2026.9.2")).toBeLessThan(0);
  });
});
