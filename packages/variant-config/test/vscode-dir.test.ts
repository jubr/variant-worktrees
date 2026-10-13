import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveMainVscodeDir } from "../src/index.js";

const tempDirectory = (): string => realpathSync(mkdtempSync(join("/tmp", "variant-vscode-dir-")));

const writeFile = (path: string, contents: string): void => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents);
};

const linkedLayout = (): { root: string; container: string; main: string; worktree: string } => {
  const root = tempDirectory();
  const container = join(root, "vw");
  const main = join(container, "variant-worktrees");
  const worktree = join(container, "_v-lib-ipc");
  writeFile(join(main, "AGENTS.md"), "# main\n");
  writeFile(join(main, ".vscode", "settings.json"), "{}\n");
  writeFile(join(worktree, "variants.yaml"), "variant: {}\n");
  writeFile(join(worktree, ".vscode", "settings.json"), "{}\n");
  symlinkSync(join(main, "AGENTS.md"), join(container, "AGENTS.md"));
  symlinkSync(join(main, ".vscode"), join(container, ".vscode"));
  return { root, container, main, worktree };
};

const singleRepoLayout = (): { repo: string; worktree: string } => {
  const repo = tempDirectory();
  const worktree = join(repo, "_v-lib-ipc");
  writeFile(join(repo, "AGENTS.md"), "# main\n");
  writeFile(join(worktree, "variants.yaml"), "variant: {}\n");
  writeFile(join(worktree, ".vscode", "settings.json"), "{}\n");
  return { repo, worktree };
};

describe("resolveMainVscodeDir", () => {
  it("uses the symlink target .vscode from a linked worktree", () => {
    const { root, main, worktree } = linkedLayout();
    try {
      expect(resolveMainVscodeDir(worktree)).toBe(join(main, ".vscode"));
      expect(resolveMainVscodeDir(worktree)).not.toBe(join(worktree, ".vscode"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses the symlink target .vscode from a nested worktree path", () => {
    const { root, main, worktree } = linkedLayout();
    const nested = join(worktree, "packages", "variant-api");
    mkdirSync(nested, { recursive: true });
    try {
      expect(resolveMainVscodeDir(nested)).toBe(join(main, ".vscode"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses the symlink target .vscode from the container root", () => {
    const { root, container, main } = linkedLayout();
    try {
      expect(resolveMainVscodeDir(container)).toBe(join(main, ".vscode"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses the main checkout .vscode when resolution starts there", () => {
    const { root, main } = linkedLayout();
    try {
      expect(resolveMainVscodeDir(main)).toBe(join(main, ".vscode"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses the repo .vscode from a single-repo worktree and does not create it", () => {
    const { repo, worktree } = singleRepoLayout();
    try {
      expect(existsSync(join(repo, ".vscode"))).toBe(false);
      expect(resolveMainVscodeDir(worktree)).toBe(join(repo, ".vscode"));
      expect(resolveMainVscodeDir(worktree)).not.toBe(join(worktree, ".vscode"));
      expect(existsSync(join(repo, ".vscode"))).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("uses the repo .vscode from a nested single-repo worktree path", () => {
    const { repo, worktree } = singleRepoLayout();
    const nested = join(worktree, "packages", "variant-api");
    mkdirSync(nested, { recursive: true });
    try {
      expect(resolveMainVscodeDir(nested)).toBe(join(repo, ".vscode"));
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("uses the repo .vscode from the single-repo root and does not create it", () => {
    const { repo } = singleRepoLayout();
    try {
      expect(resolveMainVscodeDir(repo)).toBe(join(repo, ".vscode"));
      expect(existsSync(join(repo, ".vscode"))).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("skips a package .vscode that has no settings.json", () => {
    const root = tempDirectory();
    const main = join(root, "vw", "variant-worktrees");
    const packageDir = join(main, "packages", "variant-vscode");
    writeFile(join(packageDir, ".vscode", "launch.json"), "{}\n");
    writeFile(join(main, ".vscode", "settings.json"), "{}\n");
    try {
      expect(resolveMainVscodeDir(packageDir)).toBe(join(main, ".vscode"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
