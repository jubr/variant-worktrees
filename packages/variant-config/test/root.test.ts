import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectVariantRoot } from "../src/autodetect.js";
import { loadConfig } from "../src/index.js";

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-root-"));

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

describe("variant root resolution", () => {
  it("prefers explicit variant.root relative to variants.yaml", () => {
    const directory = tempDirectory();
    try {
      const configDir = join(directory, "project");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "variants.yaml"), "variant:\n  root: ../variant-host\n");

      expect(loadConfig({ cwd: configDir }).variant?.root).toBe(join(directory, "variant-host"));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses the target directory of a parent AGENTS.md symlink", () => {
    const directory = tempDirectory();
    try {
      const mainRoot = join(directory, "main");
      const parent = join(directory, "workspace");
      const configDir = join(parent, "project");
      mkdirSync(mainRoot, { recursive: true });
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(mainRoot, "AGENTS.md"), "# main\n");
      symlinkSync(join(mainRoot, "AGENTS.md"), join(parent, "AGENTS.md"));

      expect(detectVariantRoot(configDir)).toBe(realpathSync(mainRoot));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses the git carrying directory and its real AGENTS.md as fallback", () => {
    const directory = tempDirectory();
    const repo = join(directory, "main");
    const feature = join(directory, "feature");
    try {
      execFileSync("git", ["init", "-b", "main", repo], { encoding: "utf8" });
      git(repo, "config", "user.email", "variant@example.test");
      git(repo, "config", "user.name", "Variant Tests");
      writeFileSync(join(repo, "AGENTS.md"), "# main\n");
      writeFileSync(join(repo, "variants.yaml"), "variant: {}\n");
      git(repo, "add", "AGENTS.md", "variants.yaml");
      git(repo, "commit", "-m", "initial");
      git(repo, "worktree", "add", "-b", "feat/test", feature, "main");

      expect(detectVariantRoot(feature)).toBe(realpathSync(repo));
    } finally {
      if (existsSync(feature)) {
        git(repo, "worktree", "remove", "--force", feature);
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
