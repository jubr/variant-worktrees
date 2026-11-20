import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bleedCli, publishCli } from "./bleed.ts";

const roots: string[] = [];

const temp = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "bleed-cli-"));
  roots.push(directory);
  return directory;
};

const cliPackage = (repo: string, version: string): void => {
  mkdirSync(join(repo, "packages/variant-cli"), { recursive: true });
  writeFileSync(join(repo, "packages/variant-cli/package.json"), JSON.stringify({ version }));
};

describe("publishCli", () => {
  test("publishes the host compile as variant-<version> and links variant at it", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    mkdirSync(repo);
    cliPackage(repo, "0.0.8");

    const destination = await publishCli(repo, async (outfile) => {
      writeFileSync(outfile, "variant-bytes");
      chmodSync(outfile, 0o644);
    });

    const bin = join(directory, "vw-bleeds", "variant-cli", "bin");
    expect(destination).toBe(join(bin, "variant-0.0.8"));
    expect(readFileSync(destination, "utf8")).toBe("variant-bytes");
    expect(statSync(destination).mode & 0o111).not.toBe(0);
    expect(lstatSync(join(bin, "variant")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(bin, "variant"))).toBe("variant-0.0.8");
    expect(readFileSync(join(bin, "variant"), "utf8")).toBe("variant-bytes");
  });

  test("keeps a binary from another version and points bin/variant at the new file", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    const bin = join(directory, "vw-bleeds", "variant-cli", "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "variant-0.0.7-other-3-abcd"), "other-bytes");
    writeFileSync(join(bin, "variant"), "not-a-link");
    mkdirSync(repo);
    cliPackage(repo, "0.0.8");

    await publishCli(repo, async (outfile) => {
      writeFileSync(outfile, "variant-bytes");
    });

    expect(readFileSync(join(bin, "variant-0.0.7-other-3-abcd"), "utf8")).toBe("other-bytes");
    expect(readlinkSync(join(bin, "variant"))).toBe("variant-0.0.8");
    expect(readFileSync(join(bin, "variant"), "utf8")).toBe("variant-bytes");
  });

  test("names a feature checkout variant-<version>-<slug>-<n>-<hash4>", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    mkdirSync(repo);
    cliPackage(repo, "0.0.8");
    const git = (...args: string[]): string =>
      execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
    git("init", "-b", "feat/demo");
    git("config", "user.email", "variant@example.test");
    git("config", "user.name", "Variant Tests");
    writeFileSync(join(repo, "README"), "demo\n");
    git("add", "README");
    git("commit", "-m", "demo");
    const hash = git("rev-parse", "HEAD");
    const count = git("rev-list", "--count", "HEAD");

    const destination = await publishCli(repo, async (outfile) => {
      writeFileSync(outfile, "feature-bytes");
    });

    const name = `variant-0.0.8-demo-${count}-${hash.slice(0, 4)}`;
    const bin = join(directory, "vw-bleeds", "variant-cli", "bin");
    expect(destination).toBe(join(bin, name));
    expect(readlinkSync(join(bin, "variant"))).toBe(name);
  });

  test("keeps the newest 3 binaries of variant-<version>-<slug>-* and leaves other slugs", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    const bin = join(directory, "vw-bleeds", "variant-cli", "bin");
    mkdirSync(repo);
    mkdirSync(bin, { recursive: true });
    cliPackage(repo, "0.0.8");
    const aged = (name: string, seconds: number): void => {
      const path = join(bin, name);
      writeFileSync(path, name);
      utimesSync(path, seconds, seconds);
    };
    aged("variant-0.0.8-demo-1-aaaa", 1_000);
    aged("variant-0.0.8-demo-2-bbbb", 2_000);
    aged("variant-0.0.8-demo-3-cccc", 3_000);
    aged("variant-0.0.8-other-9-dddd", 1_000);
    const git = (...args: string[]): string =>
      execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
    git("init", "-b", "feat/demo");
    git("config", "user.email", "variant@example.test");
    git("config", "user.name", "Variant Tests");
    writeFileSync(join(repo, "README"), "demo\n");
    git("add", "README");
    git("commit", "-m", "demo");

    await publishCli(repo, async (outfile) => {
      writeFileSync(outfile, "newest");
    });

    const demo = readdirSync(bin).filter((name) => name.startsWith("variant-0.0.8-demo-"));
    expect(demo).toHaveLength(3);
    expect(existsSync(join(bin, "variant-0.0.8-demo-1-aaaa"))).toBe(false);
    expect(existsSync(join(bin, "variant-0.0.8-demo-2-bbbb"))).toBe(true);
    expect(existsSync(join(bin, "variant-0.0.8-demo-3-cccc"))).toBe(true);
    expect(existsSync(join(bin, "variant-0.0.8-other-9-dddd"))).toBe(true);
  });

  test("leaves the previous executable unchanged when compile fails", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    const bin = join(directory, "vw-bleeds", "variant-cli", "bin", "variant");
    mkdirSync(join(directory, "vw-bleeds", "variant-cli", "bin"), { recursive: true });
    writeFileSync(bin, "previous-bytes");
    mkdirSync(repo);

    await expect(publishCli(repo, async () => {
      throw new Error("compile failed");
    })).rejects.toThrow("compile failed");

    expect(readFileSync(bin, "utf8")).toBe("previous-bytes");
  });

  test("does not run mise", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    const marker = join(directory, "mise-ran");
    const binDir = join(directory, "bin");
    mkdirSync(binDir, { recursive: true });
    mkdirSync(repo);
    cliPackage(repo, "0.0.8");
    writeFileSync(join(binDir, "mise"), `#!/bin/sh\nprintf ran > ${JSON.stringify(marker)}\n`);
    chmodSync(join(binDir, "mise"), 0o755);
    const previous = process.env.PATH;
    process.env.PATH = `${binDir}:${previous ?? ""}`;
    try {
      await publishCli(repo, async (outfile) => {
        writeFileSync(outfile, "variant-bytes");
      });
    } finally {
      process.env.PATH = previous;
    }
    expect(existsSync(marker)).toBe(false);
  });
});

describe("bleedCli", () => {
  test("leaves the previous executable when the variants app is not built", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    const bin = join(directory, "vw-bleeds", "variant-cli", "bin", "variant");
    mkdirSync(join(directory, "vw-bleeds", "variant-cli", "bin"), { recursive: true });
    writeFileSync(bin, "previous-bytes");
    mkdirSync(repo);

    await expect(bleedCli(repo)).rejects.toThrow("the variants app is not built");

    expect(readFileSync(bin, "utf8")).toBe("previous-bytes");
  });

  test("leaves the previous executable when VARIANT_BUN_RUNTIME names a missing file", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    const bin = join(directory, "vw-bleeds", "variant-cli", "bin", "variant");
    const missing = join(directory, "bun-standalone");
    mkdirSync(join(directory, "vw-bleeds", "variant-cli", "bin"), { recursive: true });
    writeFileSync(bin, "previous-bytes");
    mkdirSync(repo);

    await expect(bleedCli(repo, { VARIANT_BUN_RUNTIME: missing })).rejects.toThrow(missing);

    expect(readFileSync(bin, "utf8")).toBe("previous-bytes");
    expect(readdirSync(join(directory, "vw-bleeds", "variant-cli", "bin"))).toEqual(["variant"]);
  });
});

process.on("exit", () => {
  for (const directory of roots) {
    rmSync(directory, { recursive: true, force: true });
  }
});
