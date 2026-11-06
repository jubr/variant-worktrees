/**
 * The `--version` line.
 * Specification: openspec/specs/variant-api/commands/spec.md
 */

import { execFileSync } from "node:child_process";
import { sanitizeSlug } from "../../variant-api/src/slug.ts";

export const REPOSITORY_URL = "https://github.com/jubr/variant-worktrees";

const ORANGE = "\u001b[38;5;208m";
const RESET = "\u001b[0m";

export const VERSION_BANNER = [
  "                                                            _",
  "                 o                                         | |",
  "      __,   ,_       __,   _  _  _|_             __   ,_   | | _|_  ,_    _   _   ,",
  "|  |_/  |  /  |  |  /  |  / |/ |  |-----|  |  |_/  \\_/  |  |/_) |  /  |  |/  |/  / \\_",
  " \\/  \\_/|_/   |_/|_/\\_/|_/  |  |_/|_/    \\/ \\/  \\__/    |_/| \\_/|_/   |_/|__/|__/ \\/",
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

export const utcDate = (now: Date): string => now.toISOString().slice(0, 10);

export const renderBanner = (color: boolean): string => {
  const drawing = `${VERSION_BANNER}\n`;
  return color ? `${ORANGE}${drawing}${RESET}` : drawing;
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

export const formatVersionLine = (input: {
  version: string;
  platform: string;
  date: string;
  variant?: string;
}): string => {
  const token = input.variant ? `${input.version}-${input.variant}` : input.version;
  return `${token} ${input.platform} (${input.date} ${REPOSITORY_URL})`;
};
