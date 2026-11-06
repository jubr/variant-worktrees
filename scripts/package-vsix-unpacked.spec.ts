import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishExtension, unpackVsix } from "./package-vsix-unpacked.ts";

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

describe("publishExtension", () => {
  test("unpacks a checkout into vw-bleeds/variant-vscode beside that checkout", () => {
    const directory = temp();
    const repo = join(directory, "main");
    mkdirSync(repo);
    initRepo(repo);

    const destination = publishExtension(repo, fixtureVsix(directory));

    expect(realpathSync(destination)).toBe(realpathSync(join(directory, "vw-bleeds", "variant-vscode")));
    const manifest = JSON.parse(readFileSync(join(destination, "package.json"), "utf8")) as {
      name: string;
      main: string;
    };
    expect(manifest.name).toBe("variant-worktrees");
    expect(readFileSync(join(destination, manifest.main), "utf8")).toBe("exports.activate = () => {};\n");
    expect(existsSync(join(destination, "extension.vsixmanifest"))).toBe(false);
  });

  test("unpacks a worktree into vw-bleeds beside that worktree and skips out/variant-worktrees-main", () => {
    const directory = temp();
    const repo = join(directory, "main");
    const feature = join(directory, "_v-dev-bleeds");
    mkdirSync(repo);
    initRepo(repo);
    git(repo, "worktree", "add", "-q", "-b", "feat/dev-bleeds", feature, "main");

    const destination = publishExtension(feature, fixtureVsix(directory));

    expect(realpathSync(destination)).toBe(realpathSync(join(directory, "vw-bleeds", "variant-vscode")));
    expect(existsSync(join(feature, "out", "variant-worktrees-main"))).toBe(false);
    expect(existsSync(join(repo, "out", "variant-worktrees-main"))).toBe(false);
  });

  test("replaces a stale file in vw-bleeds/variant-vscode", () => {
    const directory = temp();
    const repo = join(directory, "main");
    const destination = join(directory, "vw-bleeds", "variant-vscode");
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "stale.js"), "old");
    initRepo(repo);

    publishExtension(repo, fixtureVsix(directory));

    expect(existsSync(join(destination, "stale.js"))).toBe(false);
    expect(existsSync(join(destination, "package.json"))).toBe(true);
  });

  test("leaves the previous tree when the vsix has no extension package.json", () => {
    const directory = temp();
    const repo = join(directory, "main");
    const destination = join(directory, "vw-bleeds", "variant-vscode");
    mkdirSync(join(destination), { recursive: true });
    writeFileSync(join(destination, "stale.js"), "old");
    initRepo(repo);
    const packed = join(directory, "broken");
    mkdirSync(join(packed, "extension"), { recursive: true });
    writeFileSync(join(packed, "extension", "readme.txt"), "no manifest");
    const vsix = join(directory, "broken.vsix");
    execFileSync("zip", ["-qr", vsix, "."], { cwd: packed });

    expect(() => publishExtension(repo, vsix)).toThrow("extension/package.json");

    expect(readFileSync(join(destination, "stale.js"), "utf8")).toBe("old");
  });
});

process.on("exit", () => {
  for (const directory of roots) {
    rmSync(directory, { recursive: true, force: true });
  }
});
