#!/usr/bin/env bun
/**
 * A Markdown table of the sizes behind one compiled `variant`: the runtime that ships with Bun (`bun-dist`), the
 * slim runtime, the code bundle the compile added, and what the slim runtime saved. For a job's step summary.
 *
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release executables report their sizes)
 *
 * Usage: bun scripts/runtime-sizes.ts <bun-target> <variant-executable>   (prints Markdown on standard output)
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { miseBunVersion } from "./bun-slim.ts";

export interface SizeRow {
  target: string;
  /** Bytes of the runtime that ships with Bun, when known. */
  dist?: number;
  /** Bytes of the slim runtime the executable embeds, when it embeds one. */
  slim?: number;
  /** Bytes of the compiled `variant`. */
  variant: number;
}

/** `bun-<os>-<arch>` to the zip of the runtime that ships with Bun, which calls arm64 `aarch64`. */
export const distAsset = (target: string): string => `${target.replace(/-arm64$/, "-aarch64")}.zip`;

const NONE = "–";
const kb = (bytes: number | undefined): string => (bytes === undefined ? NONE : Math.round(bytes / 1024).toLocaleString("en-US"));
const percentSmaller = (from: number | undefined, to: number | undefined): string =>
  from === undefined || to === undefined ? NONE : `${(((from - to) / from) * 100).toFixed(1)}%`;

/** The table of one target. The code bundle is the executable minus the runtime inside it (the slim one, else the default one). */
export const sizeSummary = (row: SizeRow): string => {
  const embedded = row.slim ?? row.dist;
  const code = embedded === undefined ? undefined : row.variant - embedded;
  const unslimmed = row.dist === undefined || code === undefined ? undefined : row.dist + code;
  return [
    `### ${row.target}`,
    "",
    "| bun-dist (KB) | bun-slim (KB) | smaller | added code bundle (KB) | bun-dist + code bundle (KB) | variant-cli (KB) | smaller |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${[
      kb(row.dist),
      kb(row.slim),
      percentSmaller(row.dist, row.slim),
      kb(code),
      kb(unslimmed),
      kb(row.variant),
      percentSmaller(unslimmed, row.variant),
    ].join(" | ")} |`,
    "",
  ].join("\n");
};

const findFile = (directory: string, names: string[]): string | undefined =>
  (readdirSync(directory, { recursive: true }) as string[])
    .map((entry) => join(directory, entry))
    .find((path) => names.includes(basename(path)) && statSync(path).isFile());

const sizeOf = (path: string | undefined): number | undefined => (path === undefined ? undefined : statSync(path).size);

if (import.meta.main) {
  const [target, variant] = process.argv.slice(2);
  if (target === undefined || variant === undefined) {
    console.error("usage: bun scripts/runtime-sizes.ts <bun-target> <variant-executable>");
    process.exit(2);
  }
  const root = join(import.meta.dir, "..");
  const platform = target.replace(/^bun-/, "");
  const slimDirectory = join(root, ".cache", "bun-slim", platform);
  const slim = (() => {
    try {
      return sizeOf(findFile(slimDirectory, ["bun-slim"]));
    } catch {
      return undefined;
    }
  })();
  const dist = (() => {
    try {
      const version = miseBunVersion(readFileSync(join(root, "mise.toml"), "utf8"));
      const directory = join(root, ".cache", "bun-dist", target);
      execFileSync(
        "gh",
        ["release", "download", `bun-v${version}`, "-R", "oven-sh/bun", "-p", distAsset(target), "-D", directory, "--clobber"],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      execFileSync("unzip", ["-q", "-o", join(directory, distAsset(target)), "-d", directory], { stdio: ["ignore", "pipe", "pipe"] });
      return sizeOf(findFile(directory, ["bun", "bun.exe"]));
    } catch (error) {
      console.error(`warn: ${target}: no bun-dist size (${error instanceof Error ? error.message.split("\n")[0] : error})`);
      return undefined;
    }
  })();
  process.stdout.write(sizeSummary({ target, ...(dist === undefined ? {} : { dist }), ...(slim === undefined ? {} : { slim }), variant: statSync(variant).size }));
}
