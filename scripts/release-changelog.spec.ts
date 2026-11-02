/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Changelog release notes)
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { notesFile, prepareChangelogs, promoteUnreleased, releaseNoteLines } from "./release-changelog.ts";

const notes = ["- feat: one by @a in https://github.com/o/r/pull/1", "- fix: two by @b in https://github.com/o/r/pull/2"];

const changelog = (unreleasedHeading: string, body: string): string =>
  `# Changelog\n\nPreamble.\n\n${unreleasedHeading}\n\n${body}\n## [1.2.3] - 2026-01-01\n\n### Fixed\n\n- old\n`;

describe("promoteUnreleased", () => {
  test("moves the Unreleased bullets under the new version, followed by the release notes", () => {
    const input = changelog("## [Unreleased]", "### Added\n\n- curated bullet\n");

    const output = promoteUnreleased(input, "1.2.4", "2026-02-02", notes);

    expect(output).toBe(
      `# Changelog\n\nPreamble.\n\n## [Unreleased]\n\n## [1.2.4] - 2026-02-02\n\n### Added\n\n- curated bullet\n\n### Release notes\n\n${notes.join("\n")}\n\n## [1.2.3] - 2026-01-01\n\n### Fixed\n\n- old\n`,
    );
  });
});

describe("promoteUnreleased edge cases", () => {
  test("accepts the unbracketed Unreleased heading and keeps it in place", () => {
    const input = changelog("## Unreleased", "- curated\n");

    const output = promoteUnreleased(input, "1.2.4", "2026-02-02", notes);

    expect(output).toContain("## Unreleased\n\n## [1.2.4] - 2026-02-02\n\n- curated\n\n### Release notes");
  });

  test("holds only the release notes when Unreleased is empty", () => {
    const output = promoteUnreleased(changelog("## [Unreleased]", ""), "1.2.4", "2026-02-02", notes);

    expect(output).toContain(`## [1.2.4] - 2026-02-02\n\n### Release notes\n\n${notes.join("\n")}\n\n## [1.2.3]`);
  });

  test("handles an Unreleased section that is the last section", () => {
    const output = promoteUnreleased("# Changelog\n\n## Unreleased\n\n- curated\n", "1.0.0", "2026-02-02", notes);

    expect(output).toBe(
      `# Changelog\n\n## Unreleased\n\n## [1.0.0] - 2026-02-02\n\n- curated\n\n### Release notes\n\n${notes.join("\n")}\n`,
    );
  });

  test("leaves text outside Unreleased byte-identical", () => {
    const input = changelog("## [Unreleased]", "- curated\n");

    const output = promoteUnreleased(input, "1.2.4", "2026-02-02", notes);

    expect(output.startsWith("# Changelog\n\nPreamble.\n\n## [Unreleased]")).toBe(true);
    expect(output.endsWith("## [1.2.3] - 2026-01-01\n\n### Fixed\n\n- old\n")).toBe(true);
  });

  test("fails when the version section exists", () => {
    const input = changelog("## [Unreleased]", "").replace("## [1.2.3]", "## [1.2.4]");

    expect(() => promoteUnreleased(input, "1.2.4", "2026-02-02", notes)).toThrow("already has a section for 1.2.4");
  });

  test("fails when there is no Unreleased section", () => {
    expect(() => promoteUnreleased("# Changelog\n", "1.2.4", "2026-02-02", notes)).toThrow("no Unreleased section");
  });
});

const generated = [
  "## What's Changed",
  "* feat: one by @a in https://github.com/o/r/pull/1",
  "* fix: two by @b in https://github.com/o/r/pull/2",
  "",
  "",
  "**Full Changelog**: https://github.com/o/r/compare/v1.2.3...v1.2.4",
  "",
].join("\n");

describe("releaseNoteLines", () => {
  test("keeps the pull request lines as dash bullets and the full changelog link", () => {
    expect(releaseNoteLines(generated)).toEqual([
      "- feat: one by @a in https://github.com/o/r/pull/1",
      "- fix: two by @b in https://github.com/o/r/pull/2",
      "",
      "**Full Changelog**: https://github.com/o/r/compare/v1.2.3...v1.2.4",
    ]);
  });
});

describe("prepareChangelogs", () => {
  const workspace = (): string => {
    const root = mkdtempSync(join(tmpdir(), "release-changelog-"));
    mkdirSync(join(root, "packages", "a"), { recursive: true });
    mkdirSync(join(root, "packages", "b"), { recursive: true });
    writeFileSync(join(root, "CHANGELOG.md"), changelog("## Unreleased", "- root\n"));
    writeFileSync(join(root, "packages", "a", "CHANGELOG.md"), changelog("## [Unreleased]", "- a\n"));
    writeFileSync(join(root, "packages", "b", "README.md"), "no changelog here\n");
    return root;
  };

  test("updates the root changelog and every package changelog", () => {
    const root = workspace();

    const written = prepareChangelogs(root, "1.2.4", "2026-02-02", generated);

    expect(written.sort()).toEqual(["CHANGELOG.md", "packages/a/CHANGELOG.md"]);
    for (const file of written) {
      const text = readFileSync(join(root, file), "utf8");
      expect(text).toContain("## [1.2.4] - 2026-02-02");
      expect(text).toContain("- feat: one by @a in https://github.com/o/r/pull/1");
    }
  });

  test("writes nothing when one changelog already has the version", () => {
    const root = workspace();
    const second = join(root, "packages", "a", "CHANGELOG.md");
    writeFileSync(second, readFileSync(second, "utf8").replace("## [1.2.3]", "## [1.2.4]"));
    const rootBefore = readFileSync(join(root, "CHANGELOG.md"), "utf8");

    expect(() => prepareChangelogs(root, "1.2.4", "2026-02-02", generated)).toThrow("packages/a/CHANGELOG.md");

    expect(readFileSync(join(root, "CHANGELOG.md"), "utf8")).toBe(rootBefore);
  });
});

describe("release-changelog command", () => {
  const script = join(import.meta.dir, "release-changelog.ts");

  /** A git repository with tags, a changelog, and a fake `gh` that logs its arguments and prints notes. */
  const repo = (tags: string[]) => {
    const root = mkdtempSync(join(tmpdir(), "release-changelog-cli-"));
    const bin = mkdtempSync(join(tmpdir(), "release-changelog-bin-"));
    writeFileSync(join(root, "package.json"), `${JSON.stringify({ name: "ws", version: "7.8.9" })}\n`);
    writeFileSync(join(root, "CHANGELOG.md"), changelog("## Unreleased", "- curated\n"));
    const git = (...args: string[]) => Bun.spawnSync(["git", ...args], { cwd: root });
    git("init", "-q");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
    for (const tag of tags) {
      git("tag", tag);
    }
    writeFileSync(join(bin, "gh"), `#!/bin/sh\necho "$@" > "${join(bin, "gh.args")}"\ncat <<'EOF'\n${generated}\nEOF\n`);
    chmodSync(join(bin, "gh"), 0o755);
    return { root, bin };
  };

  const run = (root: string, bin: string) =>
    Bun.spawnSync(["bun", script, root], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  test("asks GitHub for notes since the highest earlier tag and edits the changelog", () => {
    const { root, bin } = repo(["v7.8.1", "v7.8.8", "v7.8.10"]);

    const result = run(root, bin);

    expect(result.exitCode).toBe(0);
    const args = readFileSync(join(bin, "gh.args"), "utf8");
    expect(args).toContain("tag_name=v7.8.9");
    expect(args).toContain("previous_tag_name=v7.8.10");
    expect(readFileSync(join(root, "CHANGELOG.md"), "utf8")).toContain("- feat: one by @a");
    expect(readFileSync(notesFile("7.8.9"), "utf8")).toContain("## What's Changed");
  });

  test("omits the previous tag for the first release", () => {
    const { root, bin } = repo([]);

    const result = run(root, bin);

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(bin, "gh.args"), "utf8")).not.toContain("previous_tag_name");
    expect(existsSync(join(root, "CHANGELOG.md"))).toBe(true);
  });
});
