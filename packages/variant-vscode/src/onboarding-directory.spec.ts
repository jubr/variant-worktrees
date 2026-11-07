import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveOnboardingDirectory } from "./onboarding-directory.ts";

/** Specification: openspec/specs/variant-vscode/onboarding/spec.md */

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const temp = (): string => {
  const root = realpathSync(mkdtempSync(join("/tmp", "variant-onboard-dir-")));
  roots.push(root);
  return root;
};

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

const initRepo = (directory: string): void => {
  mkdirSync(directory, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main", directory]);
  git(directory, "config", "user.email", "variant@example.test");
  git(directory, "config", "user.name", "Variant Tests");
  writeFileSync(join(directory, "README.md"), "readme\n");
  git(directory, "add", "README.md");
  git(directory, "commit", "-q", "-m", "initial");
};

describe("onboarding directory", () => {
  it("follows an AGENTS.md symlink into a checkout that has no variants.yaml", () => {
    const parent = temp();
    const workspace = join(parent, "vw");
    const checkout = join(workspace, "variant-worktrees");
    mkdirSync(workspace);
    initRepo(checkout);
    writeFileSync(join(checkout, "AGENTS.md"), "# agents\n");
    symlinkSync(join(checkout, "AGENTS.md"), join(workspace, "AGENTS.md"));

    expect(resolveOnboardingDirectory(workspace)).toEqual({
      kind: "directory",
      path: realpathSync(checkout),
    });
  });

  it("uses the primary worktree when sibling directories are one repository", () => {
    const parent = temp();
    const workspace = join(parent, "vw");
    const app = join(workspace, "app");
    const linked = join(workspace, "_v-lib");
    mkdirSync(workspace);
    initRepo(app);
    git(app, "worktree", "add", "-q", "-b", "feat/lib", linked, "HEAD");

    expect(resolveOnboardingDirectory(workspace)).toEqual({ kind: "directory", path: realpathSync(app) });
  });

  it("resolves a linked worktree to the primary worktree", () => {
    const parent = temp();
    const app = join(parent, "variant-worktrees");
    const linked = join(parent, "_v-lib");
    initRepo(app);
    git(app, "worktree", "add", "-q", "-b", "feat/lib", linked, "HEAD");

    expect(resolveOnboardingDirectory(linked)).toEqual({ kind: "directory", path: realpathSync(app) });
  });

  it("keeps a workspace whose .git entry is a directory", () => {
    const parent = temp();
    const workspace = join(parent, "variant-worktrees");
    const other = join(parent, "other");
    initRepo(workspace);
    initRepo(other);
    writeFileSync(join(other, "AGENTS.md"), "# other\n");
    symlinkSync(join(other, "AGENTS.md"), join(workspace, "AGENTS.md"));

    expect(resolveOnboardingDirectory(workspace)).toEqual({
      kind: "directory",
      path: realpathSync(workspace),
    });
  });

  it("stays in a folder that contains no git checkout", () => {
    const workspace = temp();
    mkdirSync(join(workspace, "notes"));

    expect(resolveOnboardingDirectory(workspace)).toEqual({
      kind: "directory",
      path: realpathSync(workspace),
    });
  });

  it("offers a choice when two child directories are unrelated checkouts", () => {
    const parent = temp();
    const workspace = join(parent, "vw");
    const left = join(workspace, "left");
    const right = join(workspace, "right");
    mkdirSync(workspace);
    initRepo(left);
    initRepo(right);

    const result = resolveOnboardingDirectory(workspace);
    expect(result.kind).toBe("choice");
    if (result.kind === "choice") {
      expect(result.paths.toSorted()).toEqual([realpathSync(left), realpathSync(right)].toSorted());
    }
  });

  it("offers a choice when the symlink and the primary worktree differ", () => {
    const parent = temp();
    const workspace = join(parent, "vw");
    const app = join(workspace, "app");
    const other = join(workspace, "other");
    const linked = join(workspace, "_v-lib");
    mkdirSync(workspace);
    initRepo(app);
    initRepo(other);
    git(app, "worktree", "add", "-q", "-b", "feat/lib", linked, "HEAD");
    writeFileSync(join(other, "AGENTS.md"), "# other\n");
    symlinkSync(join(other, "AGENTS.md"), join(workspace, "AGENTS.md"));

    const result = resolveOnboardingDirectory(workspace);
    expect(result.kind).toBe("choice");
    if (result.kind === "choice") {
      expect(result.paths.toSorted()).toEqual([realpathSync(other), realpathSync(app)].toSorted());
    }
  });
});
