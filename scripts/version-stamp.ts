/**
 * Bun `define` values for the CLI build.
 * Specification: openspec/specs/variant-api/commands/spec.md
 */

import { execFileSync } from "node:child_process";
import { readVariant, utcDate } from "variant-api/bundle";

const hasCommit = (directory: string): boolean => {
  try {
    execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
};

/** `VARIANT_BUILD_DATE`, and `VARIANT_BUILD_VARIANT` when `directory` has a commit. Values are JSON string literals. */
export const versionDefines = (directory: string, now = new Date()): Record<string, string> => {
  const committed = hasCommit(directory);
  const variant = committed ? readVariant(directory) : "";
  const defines: Record<string, string> = {
    VARIANT_BUILD_DATE: JSON.stringify(utcDate(now, variant)),
  };
  if (committed) {
    defines.VARIANT_BUILD_VARIANT = JSON.stringify(variant);
  }
  return defines;
};
