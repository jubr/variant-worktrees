/**
 * The `--version` line.
 * Specification: openspec/specs/variant-api/commands/spec.md
 */

import { execFileSync } from "node:child_process";
import apiPackage from "../package.json" with { type: "json" };
import { sanitizeSlug } from "./slug.js";

type PackageUrl = { homepage?: string; repository?: string | { url?: string } };

/** The version-line URL: `homepage` of `variant-api`, otherwise `repository.url` without a `git+` prefix or a trailing `.git`. */
export const repositoryUrl = (pkg: PackageUrl = apiPackage): string => {
  if (typeof pkg.homepage === "string" && pkg.homepage !== "") {
    return pkg.homepage;
  }
  const repository = pkg.repository;
  const raw = typeof repository === "string" ? repository : repository?.url;
  if (typeof raw !== "string" || raw === "") {
    throw new Error("package.json needs homepage or repository.url");
  }
  return raw.replace(/^git\+/, "").replace(/\.git$/, "");
};

const ORANGE = "\u001b[38;5;208m";
const RESET = "\u001b[0m";

export const VERSION_BANNER = [
  " _                                       _                     _",
  "(_|   |_/          o                    (_|   |   |_/         | |",
  "  |   | __,   ,_       __,   _  _  _|_    |   |   | __   ,_   | | _|_  ,_    _   _   ,",
  "  |   |/  |  /  |  |  /  |  / |/ |  | --- |   |   |/  \\_/  |  |/_) |  /  |  |/  |/  / \\_",
  "   \\_/ \\_/|_/   |_/|_/\\_/|_/  |  |_/|_/    \\_/ \\_/ \\__/    |_/| \\_/|_/   |_/|__/|__/ \\/",
].join("\n");

export const versionColor = (input: { isTTY: boolean; NO_COLOR?: string }): boolean =>
  input.isTTY && input.NO_COLOR === undefined;

const git = (directory: string, args: string[]): string =>
  execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

/** The `variant` string for the checkout that contains `directory`, or empty when git cannot name a commit. */
export const readVariant = (directory: string): string => {
  try {
    const branch = git(directory, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const commit = git(directory, ["rev-parse", "HEAD"]);
    let commitsSinceTag: number;
    try {
      const tag = git(directory, ["describe", "--tags", "--abbrev=0"]);
      commitsSinceTag = Number(git(directory, ["rev-list", "--count", `${tag}..HEAD`]));
    } catch {
      commitsSinceTag = Number(git(directory, ["rev-list", "--count", "HEAD"]));
    }
    return variantString({ branch, commitsSinceTag, commit });
  } catch {
    return "";
  }
};

/** UTC date. An empty `variant` (`main`, or no commit) is `YYYY-MM-DD`. Any other variant is `YYYY-MM-DD HH:MM:SS`. */
export const utcDate = (now: Date, variant: string): string => {
  const iso = now.toISOString();
  return variant ? `${iso.slice(0, 10)} ${iso.slice(11, 19)}` : iso.slice(0, 10);
};

/**
 * Date and `variant` from `baked` when a build stamped them, otherwise from this checkout and `now`.
 * The CLI passes the stamp. The library does not read build globals, so a published package stays unstamped.
 */
export const resolveVersionFacts = (
  directory: string,
  now: Date,
  baked: { date?: string; variant?: string } = {},
): { date: string; variant: string } => {
  const variant = baked.variant ?? readVariant(directory);
  return {
    date: baked.date ?? utcDate(now, variant),
    variant,
  };
};

export const renderBanner = (color: boolean): string => {
  const drawing = `${VERSION_BANNER}\n`;
  return color ? `${ORANGE}${drawing.replaceAll("-", `${RESET}-${ORANGE}`)}${RESET}` : drawing;
};

const HASH = /^[0-9a-f]{4,}$/;

export const variantString = (input: { branch: string; commitsSinceTag: number; commit: string }): string => {
  if (input.branch === "main") {
    return "";
  }
  const commit = input.commit.trim().toLowerCase();
  if (!HASH.test(commit)) {
    return "";
  }
  return `${sanitizeSlug(input.branch)}-${input.commitsSinceTag}-${commit.slice(0, 4)}`;
};

const OS_NAMES: Record<string, string> = { darwin: "macos", win32: "windows" };

export const platformToken = (platform: string, arch: string): string => `${OS_NAMES[platform] ?? platform}-${arch}`;

/** The part of `Bun` that tells the builds apart. */
type BunRuntime = { version: string; Image?: unknown };

/**
 * The runtime the process runs on: `node`, `bun-v<version>`, `bun-standalone-v<version>` (a runtime without the bundler and
 * package manager) or `bun-slim-v<version>` (the same without `Bun.Image`, which the slim build stubs out). `build` is the
 * number of the jubr/bun-slim build the compile stamped; it ends the two standalone names, as in `bun-slim-v1.4.5-0`.
 */
export const runtimeToken = (
  bun: BunRuntime | null = (globalThis as { Bun?: BunRuntime }).Bun ?? null,
  build?: string,
): string => {
  if (bun === null) {
    return "node";
  }
  // AIDEV-NOTE: the standalone runtime reports a `-standalone` Bun.version; only the slim build leaves Bun.Image undefined.
  if (!bun.version.endsWith("-standalone")) {
    return `bun-v${bun.version}`;
  }
  const version = bun.version.slice(0, -"-standalone".length);
  const kind = bun.Image === undefined ? "bun-slim" : "bun-standalone";
  return build ? `${kind}-v${version}-${build}` : `${kind}-v${version}`;
};

const versionToken = (version: string, variant?: string): string => (variant ? `${version}-${variant}` : version);

/** Version and parenthetical, then the script drawing and a blank line when `banner` is set, then platform, runtime when given, and URL. */
export const renderVersion = (input: {
  version: string;
  platform: string;
  runtime?: string;
  date: string;
  variant?: string;
  repository: string;
  color: boolean;
  banner: boolean;
}): string => {
  const head = `${versionToken(input.version, input.variant)} (${input.date})\n`;
  const drawing = input.banner ? `${renderBanner(input.color)}\n` : "";
  const details = [input.platform, ...(input.runtime ? [input.runtime] : []), input.repository].join(", ");
  return `${head}${drawing}${details}\n`;
};

export const formatVersionLine = (input: {
  version: string;
  platform: string;
  runtime?: string;
  date: string;
  variant?: string;
  repository: string;
}): string => renderVersion({ ...input, color: false, banner: true }).replace(/\n$/, "");
