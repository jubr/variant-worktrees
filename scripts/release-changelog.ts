#!/usr/bin/env bun
/**
 * Write the notes GitHub generates for the next release into every `CHANGELOG*.md` of the workspace root and of
 * `packages/*`: the `Unreleased` bullets move under `## [version] - date`, followed by `### Release notes`.
 * The version is read from the root `package.json` (bump it first). The raw notes are also saved for the
 * release pull request body (see `notesFile`).
 *
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Changelog release notes)
 *
 * Usage: bun scripts/release-changelog.ts [workspaceRoot]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const UNRELEASED_HEADING = /^## \[?Unreleased\]?[ \t]*$/m;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Promote the `Unreleased` section of one changelog to a `## [version] - date` section that ends with the
 * generated release notes. `Unreleased` stays above it, empty. Text outside that span is untouched.
 */
export const promoteUnreleased = (text: string, version: string, date: string, notes: string[]): string => {
  if (new RegExp(`^## \\[?${escapeRegExp(version)}\\]?( |$)`, "m").test(text)) {
    throw new Error(`already has a section for ${version}`);
  }
  const heading = UNRELEASED_HEADING.exec(text);
  if (!heading) {
    throw new Error("has no Unreleased section");
  }
  const bodyStart = heading.index + heading[0].length;
  const next = /^## /m.exec(text.slice(bodyStart));
  const bodyEnd = next ? bodyStart + next.index : text.length;
  const body = text.slice(bodyStart, bodyEnd).trim();
  const section = [`## [${version}] - ${date}`, body, `### Release notes\n\n${notes.join("\n")}`]
    .filter((part) => part !== "")
    .join("\n\n");
  const rest = text.slice(bodyEnd);
  return `${text.slice(0, bodyStart)}\n\n${section}\n${rest === "" ? "" : `\n${rest}`}`;
};

/** The pull request lines of generated notes as dash bullets, plus the full-changelog link. */
export const releaseNoteLines = (generated: string): string[] => {
  const lines = generated.split("\n");
  const bullets = lines.filter((line) => line.startsWith("* ")).map((line) => `- ${line.slice(2)}`);
  const link = lines.find((line) => line.startsWith("**Full Changelog**"));
  return link ? [...bullets, "", link] : bullets;
};

/** Every `CHANGELOG*.md` directly in the root and in each `packages/<dir>`, relative to the root. */
const changelogFiles = (root: string): string[] => {
  const inDir = (dir: string): string[] =>
    existsSync(join(root, dir))
      ? readdirSync(join(root, dir), { withFileTypes: true })
          .filter((entry) => entry.isFile() && /^CHANGELOG.*\.md$/.test(entry.name))
          .map((entry) => (dir === "" ? entry.name : `${dir}/${entry.name}`))
      : [];
  const packages = existsSync(join(root, "packages"))
    ? readdirSync(join(root, "packages"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => inDir(`packages/${entry.name}`))
    : [];
  return [...inDir(""), ...packages.sort()];
};

/**
 * Promote `Unreleased` in every changelog. All files are computed before any is written, so a failing file
 * leaves the workspace untouched. Returns the changed files, relative to the root.
 */
export const prepareChangelogs = (root: string, version: string, date: string, generated: string): string[] => {
  const notes = releaseNoteLines(generated);
  const updates = changelogFiles(root).map((file) => {
    try {
      return { file, text: promoteUnreleased(readFileSync(join(root, file), "utf8"), version, date, notes) };
    } catch (error) {
      throw new Error(`${file}: ${(error as Error).message}`);
    }
  });
  for (const { file, text } of updates) {
    writeFileSync(join(root, file), text);
  }
  return updates.map(({ file }) => file);
};

/** Where the raw generated notes are saved for the release pull request body; outside the repository tree. */
export const notesFile = (version: string): string => join(tmpdir(), `release-notes-v${version}.md`);

const sh = (cmd: string[], cwd: string): string => {
  const proc = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed: ${new TextDecoder().decode(proc.stderr).trim()}`);
  }
  return new TextDecoder().decode(proc.stdout);
};

/** Highest `v*` tag that is not the new version, or undefined for the first release. */
const previousTag = (root: string, version: string): string | undefined =>
  sh(["git", "tag", "--list", "v*", "--sort=-v:refname"], root)
    .split("\n")
    .find((tag) => tag !== "" && tag !== `v${version}`);

const localDate = (now = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

if (import.meta.main) {
  const root = resolve(process.argv[2] ?? join(import.meta.dir, ".."));
  try {
    const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version as string;
    const previous = previousTag(root, version);
    const generated = sh(
      [
        "gh",
        "api",
        "repos/{owner}/{repo}/releases/generate-notes",
        "-f",
        `tag_name=v${version}`,
        ...(previous ? ["-f", `previous_tag_name=${previous}`] : []),
        "--jq",
        ".body",
      ],
      root,
    );
    const files = prepareChangelogs(root, version, localDate(), generated);
    writeFileSync(notesFile(version), generated);
    for (const file of files) {
      console.log(`updated ${file}`);
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
