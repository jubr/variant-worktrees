/**
 * Compile the `variant` CLI to a single-file executable (bun build --compile).
 *
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release contents)
 *
 * Usage: bun scripts/package-cli.ts [bun-target|all]   (default: the host platform)
 * Output: out/variant-<version>-<os>-<arch>[.exe]
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Platforms a release ships a `variant` executable for. */
export const RELEASE_TARGETS = [
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-darwin-x64",
  "bun-darwin-arm64",
  "bun-windows-x64",
  "bun-windows-arm64",
] as const;

/** `bun-<os>-<arch>` target to the asset file name `variant-<version>-<os>-<arch>[.exe]`. */
export const assetName = (version: string, target: string): string => {
  if (!(RELEASE_TARGETS as readonly string[]).includes(target)) {
    throw new Error(`unsupported target: ${target} (expected one of ${RELEASE_TARGETS.join(", ")})`);
  }
  const [, os, arch] = target.split("-");
  return `variant-${version}-${os}-${arch}${os === "windows" ? ".exe" : ""}`;
};

const hostTarget = (): string => `bun-${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;

/** Compile the CLI for one target and return the written file path. Exits the process on failure. */
const compile = (root: string, version: string, target: string): string => {
  const outfile = join(root, "out", assetName(version, target));
  const proc = Bun.spawnSync(
    ["bun", "build", join(root, "packages/variant-api/src/cli.ts"), "--compile", `--target=${target}`, "--outfile", outfile],
    { stdout: "inherit", stderr: "inherit" },
  );
  if (proc.exitCode !== 0) {
    process.exit(proc.exitCode ?? 1);
  }
  return outfile;
};

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..");
  const arg = process.argv[2] ?? hostTarget();
  const targets = arg === "all" ? RELEASE_TARGETS : [arg];
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version as string;

  mkdirSync(join(root, "out"), { recursive: true });
  for (const target of targets) {
    console.log(compile(root, version, target));
  }
}
