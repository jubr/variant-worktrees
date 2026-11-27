#!/usr/bin/env bun
/**
 * A short Markdown table for a job's step summary: the `bun-slim` release a compiled `variant` embeds, the size of that
 * runtime, and the size of `variant`. It reads files only (the cache `package:cli` left and the executable), so it
 * needs no network access and fails for no download.
 *
 * Specification: openspec/specs/meta/ci-feature-builds/spec.md (Branch builds report the slim runtime and executable sizes)
 *
 * Usage: bun scripts/slim-summary.ts <bun-target> <variant-executable> [root]   (prints Markdown on standard output)
 */
import { readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { slimRuntimeRelease } from "./bun-slim.ts";

export interface SlimRow {
  target: string;
  /** `bun-slim-vX.Y.Z-N`, when the cache holds the runtime. */
  release?: string;
  /** Bytes of the slim runtime, when the cache holds it. */
  slim?: number;
  /** Bytes of the compiled `variant`. */
  variant: number;
}

const NONE = "–";
const kb = (bytes: number | undefined): string => (bytes === undefined ? NONE : Math.round(bytes / 1024).toLocaleString("en-US"));

/** The table of one target. */
export const slimSummary = (row: SlimRow): string =>
  [
    `### ${row.target}`,
    "",
    "| bun-slim | bun-slim (KB) | variant (KB) |",
    "| --- | ---: | ---: |",
    `| ${row.release ?? NONE} | ${kb(row.slim)} | ${kb(row.variant)} |`,
    "",
  ].join("\n");

/** The `bun-slim` executable below `directory`, at any depth. */
const findSlim = (directory: string): string | undefined => {
  for (const entry of readdirSync(directory, { recursive: true }) as string[]) {
    const path = join(directory, entry);
    if (basename(path) === "bun-slim" && statSync(path).isFile()) {
      return path;
    }
  }
  return undefined;
};

if (import.meta.main) {
  const [target, variant, root = join(import.meta.dir, "..")] = process.argv.slice(2);
  if (target === undefined || variant === undefined) {
    console.error("usage: bun scripts/slim-summary.ts <bun-target> <variant-executable> [root]");
    process.exit(2);
  }
  const slimPath = (() => {
    try {
      return findSlim(join(root, ".cache", "bun-slim", target.replace(/^bun-/, "")));
    } catch {
      return undefined;
    }
  })();
  const release = slimPath === undefined ? undefined : slimRuntimeRelease(slimPath);
  process.stdout.write(
    slimSummary({
      target,
      ...(release === undefined ? {} : { release: `bun-slim-v${release.version}-${release.build}` }),
      ...(slimPath === undefined ? {} : { slim: statSync(slimPath).size }),
      variant: statSync(variant).size,
    }),
  );
}
