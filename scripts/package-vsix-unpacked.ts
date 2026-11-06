/**
 * Unpack `out/variant-worktrees-<version>.vsix` so `package.json` is the root of `vw-bleeds/variant-vscode`
 * beside the checkout, and Cursor or VS Code can load that folder.
 *
 * Specification: openspec/specs/meta/dev-bleeds/spec.md
 *
 * Usage:
 *   bun scripts/package-vsix-unpacked.ts [cwd]
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { detectVariantMain } from "../packages/variant-config/src/autodetect.ts";

/** The main checkout `cwd` publishes into: the checkout itself, or the one a variant worktree belongs to. */
export const publishTarget = (cwd: string): string => {
  const main = detectVariantMain(cwd);
  // AIDEV-NOTE: The main checkout is the load target. Only a variant worktree may publish into it.
  // AIDEV-NOTE: The main checkout may now run the task too (openspec meta/release-artifacts): it unpacks into its own out/.
  return main;
};

/** `vw-bleeds` beside the checkout that runs the task. */
export const bleedDirectory = (cwd: string): string => join(resolve(cwd), "..", "vw-bleeds");

/** Unpack `vsixPath` so `package.json` is the root of `vw-bleeds/variant-vscode`. */
export const publishExtension = (cwd: string, vsixPath: string): string => {
  const destination = join(bleedDirectory(cwd), "variant-vscode");
  unpackVsix(vsixPath, destination);
  return destination;
};

/** Replace `destination` with the extension root inside a `.vsix`, so Cursor or VS Code can load that folder. */
export const unpackVsix = (vsixPath: string, destination: string): void => {
  const staging = mkdtempSync(join(tmpdir(), "vsix-unpack-"));
  try {
    const extracted = spawnSync("unzip", ["-q", "-o", vsixPath, "-d", staging], { encoding: "utf8" });
    if (extracted.status !== 0) {
      throw new Error(extracted.stderr.trim() || `unzip failed: ${vsixPath}`);
    }
    const extension = join(staging, "extension");
    if (!existsSync(join(extension, "package.json"))) {
      throw new Error(`vsix has no extension/package.json: ${vsixPath}`);
    }
    mkdirSync(dirname(destination), { recursive: true });
    rmSync(destination, { recursive: true, force: true });
    cpSync(extension, destination, { recursive: true });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
};

const variantVsix = (root: string): string => {
  const manifest = JSON.parse(readFileSync(join(root, "packages/variant-vscode/package.json"), "utf8")) as {
    version: string;
  };
  const vsix = join(root, "out", `variant-worktrees-${manifest.version}.vsix`);
  if (!existsSync(vsix)) {
    throw new Error(`missing vsix: ${vsix}`);
  }
  return vsix;
};

if (import.meta.main) {
  const cwd = resolve(process.argv[2] ?? join(import.meta.dir, ".."));
  try {
    console.log(publishExtension(cwd, variantVsix(cwd)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
