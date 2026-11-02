#!/usr/bin/env bun
/**
 * Steps of `task release:prepare` that talk to git and GitHub.
 *
 * `check` refuses to start unless the checkout is a clean, current `main` with one release version and an
 * authenticated `gh`. `pr` commits the version bump and changelog edits on `release/v<version>`, pushes the
 * branch and opens a pull request into `main` whose body is the generated release notes. It never tags.
 *
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release preparation task, Release pull request)
 *
 * Usage: bun scripts/release-prepare.ts check|pr [workspaceRoot]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { notesFile } from "./release-changelog.ts";

const [command, rootArg] = process.argv.slice(2);
const root = resolve(rootArg ?? join(import.meta.dir, ".."));

class Failure extends Error {}

const run = (cmd: string[]): { ok: boolean; stdout: string; stderr: string } => {
  const proc = Bun.spawnSync(cmd, { cwd: root, stdout: "pipe", stderr: "pipe" });
  return {
    ok: proc.exitCode === 0,
    stdout: new TextDecoder().decode(proc.stdout).trim(),
    stderr: new TextDecoder().decode(proc.stderr).trim(),
  };
};

/** Run a command and fail with its error output. */
const must = (cmd: string[]): string => {
  const result = run(cmd);
  if (!result.ok) {
    throw new Failure(`${cmd.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
};

const check = (): void => {
  const branch = must(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "main") {
    throw new Failure(`release from main, not ${branch}`);
  }
  if (must(["git", "status", "--porcelain", "--untracked-files=no"]) !== "") {
    throw new Failure("tracked files have uncommitted changes");
  }
  must(["git", "fetch", "origin", "main"]);
  if (Number(must(["git", "rev-list", "--count", "HEAD..origin/main"])) > 0) {
    throw new Failure("main is behind origin/main; pull first");
  }
  const versions = run(["bun", join(import.meta.dir, "release-version.ts"), root]);
  if (!versions.ok) {
    throw new Failure(versions.stderr);
  }
  if (!run(["gh", "auth", "status"]).ok) {
    throw new Failure("gh is not authenticated; run `gh auth login`");
  }
};

/** Files a version bump and a changelog edit touch, relative to the root. */
const releaseFiles = (): string[] => {
  const packages = existsSync(join(root, "packages"))
    ? readdirSync(join(root, "packages"), { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];
  const candidates = [
    "package.json",
    "bun.lock",
    ...readdirSync(root).filter((name) => /^CHANGELOG.*\.md$/.test(name)),
    ...packages.flatMap((entry) => [
      `packages/${entry.name}/package.json`,
      ...readdirSync(join(root, "packages", entry.name))
        .filter((name) => /^CHANGELOG.*\.md$/.test(name))
        .map((name) => `packages/${entry.name}/${name}`),
    ]),
  ];
  return candidates.filter((file) => existsSync(join(root, file)));
};

const pr = (): void => {
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version as string;
  const body = notesFile(version);
  if (!existsSync(body)) {
    throw new Failure(`no generated release notes at ${body}; run \`task release:changelog\` first`);
  }
  const branch = `release/v${version}`;
  const title = `chore(release): v${version}`;
  const exists = run(["git", "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).ok;
  must(exists ? ["git", "switch", branch] : ["git", "switch", "-c", branch]);
  must(["git", "add", "--", ...releaseFiles()]);
  if (!run(["git", "diff", "--cached", "--quiet"]).ok) {
    must(["git", "commit", "-m", title]);
  }
  must(["git", "push", "-u", "origin", branch]);
  console.log(must(["gh", "pr", "create", "--base", "main", "--title", title, "--body-file", body]));
};

try {
  if (command === "check") {
    check();
  } else if (command === "pr") {
    pr();
  } else {
    throw new Failure("usage: release-prepare.ts check|pr [workspaceRoot]");
  }
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
