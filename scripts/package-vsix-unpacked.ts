/**
 * From the main checkout or a variant worktree, unpack `out/variant-worktrees-<version>.vsix` into the main checkout at
 * `out/variant-worktrees-main`, with `package.json` at that folder's root so Cursor or VS Code can load it.
 *
 * Usage:
 *   bun scripts/package-vsix-unpacked.ts [cwd]
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { detectVariantMain } from "../packages/variant-config/src/autodetect.ts";

const UNPACKED_EXTENSION_DIR = "variant-worktrees-main";

/** The main checkout `cwd` publishes into: the checkout itself, or the one a variant worktree belongs to. */
export const publishTarget = (cwd: string): string => {
  const main = detectVariantMain(cwd);
  // AIDEV-NOTE: The main checkout is the load target. Only a variant worktree may publish into it.
  // AIDEV-NOTE: The main checkout may now run the task too (openspec meta/release-artifacts): it unpacks into its own out/.
  return main;
};

/** Unpack `vsixPath` into the main checkout's `out/variant-worktrees-main`, from the main checkout or a worktree. */
export const unpackIntoMain = (cwd: string, vsixPath: string): string => {
  const destination = join(publishTarget(cwd), "out", UNPACKED_EXTENSION_DIR);
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
    console.log(unpackIntoMain(cwd, variantVsix(cwd)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
