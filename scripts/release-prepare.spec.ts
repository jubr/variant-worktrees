/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release preparation task, Release pull request)
 */
import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { notesFile } from "./release-changelog.ts";

const script = join(import.meta.dir, "release-prepare.ts");

const PACKAGES = ["variant-api", "variant-cli", "variant-vscode", "chat-renamer-vscode"];

const dirs: string[] = [];
const tmp = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const git = (cwd: string, ...args: string[]): string => {
  const proc = Bun.spawnSync(
    ["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
    { cwd, stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")}: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return new TextDecoder().decode(proc.stdout);
};

/** A clone of a bare origin on `main`, release packages at `version`, plus a fake `gh` that logs its calls. */
const checkout = (version = "1.2.3") => {
  const base = tmp("release-prepare-");
  const origin = join(base, "origin.git");
  const root = join(base, "work");
  const bin = join(base, "bin");
  mkdirSync(bin);
  git(base, "init", "-q", "--bare", "-b", "main", origin);
  git(base, "init", "-q", "-b", "main", root);
  // The script commits with the repository's own identity; CI runners have no global one.
  git(root, "config", "user.name", "Release Test");
  git(root, "config", "user.email", "release-test@example.com");
  git(root, "config", "commit.gpgsign", "false");
  const manifest = (name: string): string => `${JSON.stringify({ name, version })}\n`;
  writeFileSync(join(root, "package.json"), manifest("ws"));
  for (const name of PACKAGES) {
    mkdirSync(join(root, "packages", name), { recursive: true });
    writeFileSync(join(root, "packages", name, "package.json"), manifest(name));
  }
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\n## Unreleased\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");
  git(root, "remote", "add", "origin", origin);
  git(root, "push", "-q", "-u", "origin", "main");
  const ghLog = join(base, "gh.log");
  writeFileSync(
    join(bin, "gh"),
    `#!/bin/sh\necho "$@" >> "${ghLog}"\nif [ "$1 $2" = "auth status" ] && [ -f "${join(base, "gh-unauthenticated")}" ]; then exit 1; fi\nexit 0\n`,
  );
  chmodSync(join(bin, "gh"), 0o755);
  return { base, origin, root, ghLog, unauthenticate: () => writeFileSync(join(base, "gh-unauthenticated"), ""), bin };
};

const run = async (command: "check" | "pr", c: ReturnType<typeof checkout>) => {
  const proc = Bun.spawn(["bun", script, command, c.root], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, PATH: `${c.bin}:${process.env.PATH}` },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
};

describe("release-prepare check", () => {
  test("passes on a clean, current main", async () => {
    const c = checkout();

    expect((await run("check", c)).code).toBe(0);
  });

  test("fails off main and names the branch", async () => {
    const c = checkout();
    git(c.root, "switch", "-q", "-c", "topic");

    const result = await run("check", c);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("topic");
  });

  test("fails with a dirty working tree", async () => {
    const c = checkout();
    writeFileSync(join(c.root, "CHANGELOG.md"), "changed\n");

    const result = await run("check", c);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("uncommitted");
    expect(readFileSync(join(c.root, "CHANGELOG.md"), "utf8")).toBe("changed\n");
  });

  test("fails when main is behind origin", async () => {
    const c = checkout();
    const other = join(c.base, "other");
    git(c.base, "clone", "-q", c.origin, other);
    writeFileSync(join(other, "x.txt"), "x\n");
    git(other, "add", "-A");
    git(other, "commit", "-q", "-m", "ahead");
    git(other, "push", "-q", "origin", "main");

    const result = await run("check", c);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("behind origin/main");
  });

  test("fails when the release packages differ in version", async () => {
    const c = checkout();
    const file = join(c.root, "packages", "variant-api", "package.json");
    writeFileSync(file, readFileSync(file, "utf8").replace("1.2.3", "1.2.0"));
    git(c.root, "commit", "-q", "-am", "skew");
    git(c.root, "push", "-q", "origin", "main");

    const result = await run("check", c);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("must share one version");
  });

  test("fails when gh is not authenticated", async () => {
    const c = checkout();
    c.unauthenticate();

    const result = await run("check", c);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("gh");
  });
});

describe("release-prepare pr", () => {
  /** The state `version:incr:patch` and `release:changelog` leave behind. */
  const bumped = (c: ReturnType<typeof checkout>, next = "1.2.4") => {
    for (const file of ["package.json", ...PACKAGES.map((name) => `packages/${name}/package.json`)]) {
      const path = join(c.root, file);
      writeFileSync(path, readFileSync(path, "utf8").replace("1.2.3", next));
    }
    writeFileSync(join(c.root, "CHANGELOG.md"), `# Changelog\n\n## Unreleased\n\n## [${next}] - 2026-02-02\n`);
    writeFileSync(notesFile(next), "## What's Changed\n* feat: one\n");
  };

  test("commits on release/v<version>, pushes it, and opens a pull request into main without tagging", async () => {
    const c = checkout();
    bumped(c);

    const result = await run("pr", c);

    expect(result.code).toBe(0);
    expect(git(c.root, "branch", "--show-current").trim()).toBe("release/v1.2.4");
    expect(git(c.root, "log", "--format=%s", "main..HEAD").trim()).toBe("chore(release): v1.2.4");
    expect(git(c.root, "status", "--porcelain").trim()).toBe("");
    expect(git(c.origin, "branch", "--list", "release/v1.2.4")).toContain("release/v1.2.4");
    expect(git(c.origin, "tag", "--list").trim()).toBe("");
    const calls = readFileSync(c.ghLog, "utf8");
    expect(calls).toContain("pr create --base main --title chore(release): v1.2.4 --body-file");
    expect(calls).toContain(notesFile("1.2.4"));
  });

  test("keeps the commit when the push fails, and a second run pushes without a second commit", async () => {
    const c = checkout();
    bumped(c);
    git(c.root, "remote", "set-url", "origin", join(c.base, "missing.git"));

    const failed = await run("pr", c);

    expect(failed.code).toBe(1);
    expect(git(c.root, "log", "--format=%s", "main..HEAD").trim()).toBe("chore(release): v1.2.4");

    git(c.root, "remote", "set-url", "origin", c.origin);
    const retried = await run("pr", c);

    expect(retried.code).toBe(0);
    expect(git(c.root, "log", "--format=%s", "main..HEAD").trim().split("\n")).toHaveLength(1);
    expect(git(c.origin, "branch", "--list", "release/v1.2.4")).toContain("release/v1.2.4");
    expect(readFileSync(c.ghLog, "utf8")).toContain("pr create");
  });

  test("fails before committing when the generated notes are missing", async () => {
    const c = checkout();
    bumped(c, "1.2.5");
    rmSync(notesFile("1.2.5"));

    const result = await run("pr", c);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("release:changelog");
    expect(git(c.root, "branch", "--show-current").trim()).toBe("main");
  });
});
