#!/usr/bin/env bun
/**
 * Smoke a compiled `variant`: `--version` must name the slim runtime of the Bun version `mise.toml` pins.
 * Fails when jubr/bun-slim has no build of that version (the compile then embedded the default runtime), so a branch
 * learns that before a release does.
 *
 * Specification: openspec/specs/meta/ci-feature-builds/spec.md (Slim runtime available for the pinned Bun)
 *
 * Usage: bun scripts/smoke-slim.ts <variant-executable>
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expectSlimRuntime, miseBunVersion } from "./bun-slim.ts";

const executable = process.argv[2];
if (executable === undefined) {
  console.error("usage: bun scripts/smoke-slim.ts <variant-executable>");
  process.exit(2);
}

try {
  const output = execFileSync(executable, ["--version"], { encoding: "utf8" });
  process.stdout.write(output);
  expectSlimRuntime(output, miseBunVersion(readFileSync(join(import.meta.dir, "..", "mise.toml"), "utf8")));
} catch (error) {
  console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
