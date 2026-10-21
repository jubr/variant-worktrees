/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Lockstep release version)
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "release-version.ts");

const PACKAGE_FILES = {
  root: "package.json",
  "variant-api": "packages/variant-api/package.json",
  "variant-vscode": "packages/variant-vscode/package.json",
  "chat-renamer-vscode": "packages/chat-renamer-vscode/package.json",
} as const;

const roots: string[] = [];

/** Build a throwaway workspace whose four release packages declare the given versions. */
const workspace = (versions: Record<keyof typeof PACKAGE_FILES, string>): string => {
  const root = mkdtempSync(join(tmpdir(), "release-version-"));
  roots.push(root);
  for (const [name, file] of Object.entries(PACKAGE_FILES)) {
    const path = join(root, file);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, JSON.stringify({ name, version: versions[name as keyof typeof PACKAGE_FILES] }));
  }
  return root;
};

const run = async (root: string) => {
  const proc = Bun.spawn(["bun", script, root], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("release-version", () => {
  test("prints the shared version when all four packages agree", async () => {
    const root = workspace({
      root: "1.2.3",
      "variant-api": "1.2.3",
      "variant-vscode": "1.2.3",
      "chat-renamer-vscode": "1.2.3",
    });

    const result = await run(root);

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("1.2.3");
  });

  test("fails and names every package with its version when versions differ", async () => {
    const root = workspace({
      root: "1.2.3",
      "variant-api": "1.2.3",
      "variant-vscode": "1.2.4",
      "chat-renamer-vscode": "1.2.2",
    });

    const result = await run(root);

    expect(result.code).not.toBe(0);
    expect(result.stdout.trim()).toBe("");
    for (const line of [
      "package.json: 1.2.3",
      "packages/variant-api/package.json: 1.2.3",
      "packages/variant-vscode/package.json: 1.2.4",
      "packages/chat-renamer-vscode/package.json: 1.2.2",
    ]) {
      expect(result.stderr).toContain(line);
    }
  });
});
