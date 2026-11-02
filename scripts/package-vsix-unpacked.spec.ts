import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unpackIntoMain, unpackVsix } from "./package-vsix-unpacked.ts";

const git = (cwd: string, ...args: string[]): void => {
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
};

const initRepo = (repo: string): void => {
  execFileSync("git", ["init", "-q", "-b", "main", repo], { encoding: "utf8" });
  git(repo, "config", "user.email", "variant@example.test");
  git(repo, "config", "user.name", "Variant Tests");
  writeFileSync(join(repo, "AGENTS.md"), "# main\n");
  git(repo, "add", "AGENTS.md");
  git(repo, "commit", "-q", "-m", "initial");
};

const roots: string[] = [];

const temp = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "vsix-unpacked-"));
  roots.push(directory);
  return directory;
};

/** A vsix whose loadable extension lives under `extension/`, plus the vsix wrapper files. */
const fixtureVsix = (directory: string): string => {
  const packed = join(directory, "packed");
  mkdirSync(join(packed, "extension", "dist"), { recursive: true });
  writeFileSync(
    join(packed, "extension", "package.json"),
    `${JSON.stringify({ name: "variant-worktrees", publisher: "jubr", main: "./dist/extension.cjs" }, null, 2)}\n`,
  );
  writeFileSync(join(packed, "extension", "dist", "extension.cjs"), "exports.activate = () => {};\n");
  writeFileSync(join(packed, "extension.vsixmanifest"), "<PackageManifest/>\n");
  const vsix = join(directory, "variant-worktrees-0.0.4.vsix");
  execFileSync("zip", ["-qr", vsix, "."], { cwd: packed });
  return vsix;
};

describe("unpackVsix", () => {
  test("replaces the destination with the extension root, so the folder loads in VS Code", () => {
    const directory = temp();
    const destination = join(directory, "out", "variant-worktrees-main");
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "stale.js"), "old");

    unpackVsix(fixtureVsix(directory), destination);

    const manifest = JSON.parse(readFileSync(join(destination, "package.json"), "utf8")) as {
      name: string;
      main: string;
    };
    expect(manifest.name).toBe("variant-worktrees");
    expect(manifest.main).toBe("./dist/extension.cjs");
    expect(readFileSync(join(destination, "dist", "extension.cjs"), "utf8")).toBe("exports.activate = () => {};\n");
    expect(existsSync(join(destination, "stale.js"))).toBe(false);
    expect(existsSync(join(destination, "extension.vsixmanifest"))).toBe(false);
    expect(existsSync(join(destination, "extension", "package.json"))).toBe(false);
  });
});

describe("unpackIntoMain", () => {
  test("refuses the main checkout and leaves its out directory untouched", () => {
    const directory = temp();
    const repo = join(directory, "main");
    mkdirSync(repo);
    initRepo(repo);

    expect(() => unpackIntoMain(repo, fixtureVsix(directory))).toThrow(
      "package:vsix:unpacked runs only in a variant worktree",
    );
    expect(existsSync(join(repo, "out", "variant-worktrees-main"))).toBe(false);
  });

  test("unpacks a linked worktree into the main checkout at out/variant-worktrees-main", () => {
    const directory = temp();
    const repo = join(directory, "main");
    const feature = join(directory, "_v-vscode-view");
    mkdirSync(repo);
    initRepo(repo);
    git(repo, "worktree", "add", "-q", "-b", "feat/vscode-view", feature, "main");

    const destination = unpackIntoMain(feature, fixtureVsix(directory));

    expect(destination).toBe(join(realpathSync(repo), "out", "variant-worktrees-main"));
    const manifest = JSON.parse(readFileSync(join(destination, "package.json"), "utf8")) as { name: string };
    expect(manifest.name).toBe("variant-worktrees");
    expect(existsSync(join(feature, "out", "variant-worktrees-main"))).toBe(false);
  });
});

describe("package-vsix-unpacked --check", () => {
  const script = join(import.meta.dir, "package-vsix-unpacked.ts");

  const runScript = (...args: string[]) => {
    const result = Bun.spawnSync(["bun", script, ...args], { stderr: "pipe", stdout: "pipe" });
    return { status: result.exitCode, stderr: result.stderr.toString() };
  };

  test("exits 0 in a linked worktree and fails in the main checkout", () => {
    const directory = temp();
    const repo = join(directory, "main");
    const feature = join(directory, "_v-vscode-view");
    mkdirSync(repo);
    initRepo(repo);
    git(repo, "worktree", "add", "-q", "-b", "feat/vscode-view", feature, "main");

    const main = runScript("--check", repo);
    const linked = runScript("--check", feature);

    expect(main.status).not.toBe(0);
    expect(main.stderr).toContain("package:vsix:unpacked runs only in a variant worktree");
    expect(linked.status).toBe(0);
  });
});

process.on("exit", () => {
  for (const directory of roots) {
    rmSync(directory, { recursive: true, force: true });
  }
});
