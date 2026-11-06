import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bleedCli, publishCli } from "./bleed.ts";

const roots: string[] = [];

const temp = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "bleed-cli-"));
  roots.push(directory);
  return directory;
};

describe("publishCli", () => {
  test("publishes the host compile as the only executable at bin/variant", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    mkdirSync(repo);

    const destination = await publishCli(repo, async (outfile) => {
      writeFileSync(outfile, "variant-bytes");
      chmodSync(outfile, 0o644);
    });

    expect(destination).toBe(join(directory, "vw-bleeds", "variant-cli", "bin", "variant"));
    expect(readFileSync(destination, "utf8")).toBe("variant-bytes");
    expect(statSync(destination).mode & 0o111).not.toBe(0);
    expect(readdirSync(join(directory, "vw-bleeds", "variant-cli"), { recursive: true }).map(String).sort()).toEqual([
      "bin",
      join("bin", "variant"),
    ]);
  });

  test("drops a stale file already in variant-cli", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    const stale = join(directory, "vw-bleeds", "variant-cli", "old.txt");
    mkdirSync(join(directory, "vw-bleeds", "variant-cli"), { recursive: true });
    writeFileSync(stale, "old");
    mkdirSync(repo);

    await publishCli(repo, async (outfile) => {
      writeFileSync(outfile, "variant-bytes");
    });

    expect(existsSync(stale)).toBe(false);
    expect(readFileSync(join(directory, "vw-bleeds", "variant-cli", "bin", "variant"), "utf8")).toBe("variant-bytes");
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
});

process.on("exit", () => {
  for (const directory of roots) {
    rmSync(directory, { recursive: true, force: true });
  }
});
