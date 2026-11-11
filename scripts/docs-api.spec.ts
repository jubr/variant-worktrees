/**
 * Specification: openspec/specs/docs/site/spec.md (API reference from a fresh checkout)
 */
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

test("docs:api typechecks variant-api when variant-log has not been built", () => {
  rmSync(join(root, "packages/variant-log/dist"), { recursive: true, force: true });
  const result = spawnSync("bun", ["run", "docs:api"], { cwd: root, encoding: "utf8" });
  const output = `${result.stdout}\n${result.stderr}`;
  expect(result.status, output).toBe(0);
  expect(output).not.toContain("Cannot find module 'variant-log'");
}, 120_000);
