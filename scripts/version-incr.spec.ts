/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Patch version bump)
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "version-incr.ts");

const roots: string[] = [];

/** Build a throwaway workspace: root plus the given package dirs, each with a `bun.lock` entry. */
const workspace = (versions: Record<string, string>, rootVersion = "1.2.3"): string => {
  const root = mkdtempSync(join(tmpdir(), "version-incr-"));
  roots.push(root);
  writeFileSync(join(root, "package.json"), `${JSON.stringify({ name: "ws", version: rootVersion }, null, 2)}\n`);
  const entries = ['    "": {\n      "name": "ws",\n    },'];
  for (const [dir, version] of Object.entries(versions)) {
    mkdirSync(join(root, "packages", dir), { recursive: true });
    writeFileSync(
      join(root, "packages", dir, "package.json"),
      `${JSON.stringify({ name: dir, version, private: true }, null, 2)}\n`,
    );
    entries.push(`    "packages/${dir}": {\n      "name": "${dir}",\n      "version": "${version}",\n    },`);
  }
  writeFileSync(
    join(root, "bun.lock"),
    `{\n  "lockfileVersion": 1,\n  "workspaces": {\n${entries.join("\n")}\n  },\n  "packages": {\n    "dep": ["dep@1.2.3"],\n  },\n}\n`,
  );
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

const versionOf = (root: string, file: string): string => JSON.parse(readFileSync(join(root, file), "utf8")).version;

afterEach(() => {
  for (const dir of roots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("version-incr", () => {
  test("bumps the patch of the root and every package and prints the new version", async () => {
    const root = workspace({ a: "1.2.3", b: "1.2.3" });

    const result = await run(root);

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("1.2.4");
    expect(versionOf(root, "package.json")).toBe("1.2.4");
    expect(versionOf(root, "packages/a/package.json")).toBe("1.2.4");
    expect(versionOf(root, "packages/b/package.json")).toBe("1.2.4");
  });

  test("rewrites workspace versions in bun.lock and leaves other lines alone", async () => {
    const root = workspace({ a: "1.2.3" });

    await run(root);

    const lock = readFileSync(join(root, "bun.lock"), "utf8");
    expect(lock).toContain('"name": "a",\n      "version": "1.2.4",');
    expect(lock).not.toContain('"version": "1.2.3"');
    expect(lock).toContain('"dep": ["dep@1.2.3"]');
  });

  test("preserves package.json formatting apart from the version", async () => {
    const root = workspace({ a: "1.2.3" });
    const before = readFileSync(join(root, "packages/a/package.json"), "utf8");

    await run(root);

    expect(readFileSync(join(root, "packages/a/package.json"), "utf8")).toBe(before.replace("1.2.3", "1.2.4"));
  });

  test("refuses to bump when versions differ and changes nothing", async () => {
    const root = workspace({ a: "1.2.3", b: "1.2.5" });

    const result = await run(root);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("packages/b/package.json: 1.2.5");
    expect(versionOf(root, "package.json")).toBe("1.2.3");
    expect(versionOf(root, "packages/a/package.json")).toBe("1.2.3");
  });

  test("fails on a version that is not plain major.minor.patch", async () => {
    const root = workspace({ a: "1.2.3-beta.1" });

    const result = await run(root);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("1.2.3-beta.1");
  });
});
