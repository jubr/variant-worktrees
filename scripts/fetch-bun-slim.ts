#!/usr/bin/env bun
/**
 * Fetch the slim Bun runtime of one platform for `VARIANT_BUN_RUNTIME`, to try it by hand. `task package:cli` and
 * `task bleed:cli` fetch it themselves when the variable is unset (`selectRuntime` in `package-cli.ts`).
 *
 * Reads the Bun version from `mise.toml`, downloads the zip of the newest bun-slim build of exactly that version
 * (github.com/jubr/bun-slim) and, in a GitHub Actions run, appends `VARIANT_BUN_RUNTIME=<executable>` to `$GITHUB_ENV`.
 * Any failure is a warning and exit 0: the executable is then compiled with the Bun runtime that ships with Bun.
 *
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release executables use the published slim runtime)
 *
 * Usage: bun scripts/fetch-bun-slim.ts <platform>   (linux-x64, linux-arm64, darwin-x64, darwin-arm64)
 */
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchSlimRuntimeFor, miseBunVersion } from "./bun-slim.ts";

const root = join(import.meta.dir, "..");

const platform = process.argv[2];
if (platform === undefined) {
  console.error("usage: bun scripts/fetch-bun-slim.ts <platform>");
  process.exit(2);
}

try {
  const version = miseBunVersion(readFileSync(join(root, "mise.toml"), "utf8"));
  const runtime = fetchSlimRuntimeFor(root, platform);
  console.log(`slim runtime for Bun ${version} on ${platform}: ${runtime}`);
  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `VARIANT_BUN_RUNTIME=${runtime}\n`);
  } else {
    console.log(`VARIANT_BUN_RUNTIME=${runtime}`);
  }
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.log(`::warning::no slim Bun runtime for ${platform} (${reason.split("\n")[0]}); compiling with the default runtime`);
}
