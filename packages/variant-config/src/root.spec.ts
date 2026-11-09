import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectVariantMain, detectVariantRoot } from "./autodetect.js";
import { loadConfig } from "./index.js";

const tempDirectory = (): string => realpathSync(mkdtempSync(join("/tmp", "variant-root-")));

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

const initRepo = (repo: string): void => {
  execFileSync("git", ["init", "-q", "-b", "main", repo], { encoding: "utf8" });
  git(repo, "config", "user.email", "variant@example.test");
  git(repo, "config", "user.name", "Variant Tests");
  writeFileSync(join(repo, "AGENTS.md"), "# main\n");
  writeFileSync(join(repo, "variants.yaml"), "variant: {}\n");
  git(repo, "add", "AGENTS.md", "variants.yaml");
  git(repo, "commit", "-q", "-m", "initial");
};

/** A temporary directory with the cleanup of linked worktrees and the directory itself. */
const withDirectory = (run: (directory: string) => void): void => {
  const directory = tempDirectory();
  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("variant main and root resolution", () => {
  it("prefers explicit variant.root and variant.main relative to variants.yaml", () =>
    withDirectory((directory) => {
      const configDir = join(directory, "project");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "variants.yaml"), "variant:\n  main: ../app\n  root: ../variant-host\n");

      const { variant } = loadConfig({ cwd: configDir });

      expect(variant?.main).toBe(join(directory, "app"));
      expect(variant?.root).toBe(join(directory, "variant-host"));
    }));

  it("makes an explicit variant.main the root when nothing else says otherwise", () =>
    withDirectory((directory) => {
      const configDir = join(directory, "project");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "variants.yaml"), "variant:\n  main: ../app\n");

      expect(loadConfig({ cwd: configDir }).variant?.root).toBe(join(directory, "app"));
    }));

  it("takes the main tree from the target of a parent AGENTS.md symlink and the root from the symlink's directory", () =>
    withDirectory((directory) => {
      const workspace = join(directory, "workspace");
      const main = join(workspace, "app");
      mkdirSync(main, { recursive: true });
      writeFileSync(join(main, "AGENTS.md"), "# main\n");
      writeFileSync(join(main, "variants.yaml"), "variant: {}\n");
      symlinkSync(join(main, "AGENTS.md"), join(workspace, "AGENTS.md"));

      const { variant } = loadConfig({ cwd: main });

      expect(variant?.main).toBe(main);
      expect(variant?.root).toBe(workspace);
    }));

  it("keeps main and root of a linked worktree that sits in the symlink's directory", () =>
    withDirectory((directory) => {
      const workspace = join(directory, "workspace");
      const main = join(workspace, "app");
      const linked = join(workspace, "_v-bar");
      mkdirSync(main, { recursive: true });
      initRepo(main);
      symlinkSync(join(main, "AGENTS.md"), join(workspace, "AGENTS.md"));
      git(main, "worktree", "add", "-q", "-b", "feat/bar", linked, "main");

      const { variant } = loadConfig({ cwd: linked });

      expect(variant?.main).toBe(main);
      expect(variant?.root).toBe(workspace);
    }));

  it("ignores a parent AGENTS.md symlink that points outside the main tree", () =>
    withDirectory((directory) => {
      const main = join(directory, "app");
      const elsewhere = join(directory, "elsewhere");
      mkdirSync(main);
      mkdirSync(elsewhere);
      writeFileSync(join(elsewhere, "AGENTS.md"), "# other\n");
      symlinkSync(join(elsewhere, "AGENTS.md"), join(directory, "AGENTS.md"));

      expect(detectVariantRoot(main, main)).toBe(main);
    }));

  it("uses the git carrying directory as main and root without a symlink", () =>
    withDirectory((directory) => {
      const repo = join(directory, "main");
      const feature = join(directory, "feature");
      mkdirSync(repo);
      initRepo(repo);
      git(repo, "worktree", "add", "-q", "-b", "feat/test", feature, "main");

      expect(detectVariantMain(feature)).toBe(repo);
      expect(detectVariantMain(repo)).toBe(repo);
      expect(detectVariantRoot(feature, repo)).toBe(repo);
      expect(loadConfig({ cwd: feature }).variant?.root).toBe(repo);
    }));

  it("loads the main checkout from a variant root that has no variants.yaml", () =>
    withDirectory((directory) => {
      const workspace = join(directory, "workspace");
      const main = join(workspace, "app");
      mkdirSync(main, { recursive: true });
      initRepo(main);
      symlinkSync(join(main, "AGENTS.md"), join(workspace, "AGENTS.md"));

      const loaded = loadConfig({ cwd: workspace });

      expect(loaded.configPath).toBe(join(main, "variants.yaml"));
      expect(loaded.variant?.main).toBe(main);
      expect(loaded.variant?.root).toBe(workspace);
    }));

  it("warns and skips a variants.yaml symlink in the variant root", () =>
    withDirectory((directory) => {
      const workspace = join(directory, "workspace");
      const main = join(workspace, "app");
      mkdirSync(main, { recursive: true });
      initRepo(main);
      symlinkSync(join(main, "AGENTS.md"), join(workspace, "AGENTS.md"));
      symlinkSync(join(main, "variants.yaml"), join(workspace, "variants.yaml"));

      const loaded = loadConfig({ cwd: workspace });

      expect(loaded.configPath).toBe(join(main, "variants.yaml"));
      expect(loaded.warnings.join("\n")).toContain(join(workspace, "variants.yaml"));
      expect(loaded.warnings.join("\n")).toContain("anti-pattern");
    }));

  it("keeps a real variants.yaml in the variant root and does not warn", () =>
    withDirectory((directory) => {
      const workspace = join(directory, "workspace");
      const main = join(workspace, "app");
      mkdirSync(main, { recursive: true });
      initRepo(main);
      symlinkSync(join(main, "AGENTS.md"), join(workspace, "AGENTS.md"));
      writeFileSync(join(workspace, "variants.yaml"), "variant: {}\n");

      const loaded = loadConfig({ cwd: workspace });

      expect(loaded.configPath).toBe(join(workspace, "variants.yaml"));
      expect(loaded.warnings).toEqual([]);
    }));

  it("uses the directory of variants.yaml as main and root outside git", () =>
    withDirectory((directory) => {
      expect(detectVariantMain(directory)).toBe(directory);
      expect(detectVariantRoot(directory, directory)).toBe(directory);
      expect(existsSync(directory)).toBe(true);
    }));
});
