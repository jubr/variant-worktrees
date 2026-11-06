import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bleedCli, bleedMcp, compileMcp, publishCli, publishMcp } from "./bleed.ts";

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

describe("publishMcp", () => {
  test("publishes the host compile as the only executable at bin/variant-mcp", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    mkdirSync(repo);

    const destination = await publishMcp(repo, async (outfile) => {
      writeFileSync(outfile, "mcp-bytes");
    });

    expect(destination).toBe(join(directory, "vw-bleeds", "variant-mcp", "bin", "variant-mcp"));
    expect(readFileSync(destination, "utf8")).toBe("mcp-bytes");
    expect(statSync(destination).mode & 0o111).not.toBe(0);
    expect(readdirSync(join(directory, "vw-bleeds", "variant-mcp"), { recursive: true }).map(String).sort()).toEqual([
      "bin",
      join("bin", "variant-mcp"),
    ]);
  });

  test("drops a stale file already in variant-mcp", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    const stale = join(directory, "vw-bleeds", "variant-mcp", "old.txt");
    mkdirSync(join(directory, "vw-bleeds", "variant-mcp"), { recursive: true });
    writeFileSync(stale, "old");
    mkdirSync(repo);

    await publishMcp(repo, async (outfile) => {
      writeFileSync(outfile, "mcp-bytes");
    });

    expect(existsSync(stale)).toBe(false);
    expect(readFileSync(join(directory, "vw-bleeds", "variant-mcp", "bin", "variant-mcp"), "utf8")).toBe("mcp-bytes");
  });

  test("leaves the previous executable unchanged when compile fails", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    const bin = join(directory, "vw-bleeds", "variant-mcp", "bin", "variant-mcp");
    mkdirSync(join(directory, "vw-bleeds", "variant-mcp", "bin"), { recursive: true });
    writeFileSync(bin, "previous-bytes");
    mkdirSync(repo);

    await expect(
      publishMcp(repo, async () => {
        throw new Error("compile failed");
      }),
    ).rejects.toThrow("compile failed");

    expect(readFileSync(bin, "utf8")).toBe("previous-bytes");
  });
});

describe("bleedMcp", () => {
  test("leaves the previous executable when the variant-mcp entry is missing", async () => {
    const directory = temp();
    const repo = join(directory, "checkout");
    const bin = join(directory, "vw-bleeds", "variant-mcp", "bin", "variant-mcp");
    mkdirSync(join(directory, "vw-bleeds", "variant-mcp", "bin"), { recursive: true });
    writeFileSync(bin, "previous-bytes");
    mkdirSync(repo);

    await expect(bleedMcp(repo)).rejects.toThrow("variant-mcp entry is missing");

    expect(readFileSync(bin, "utf8")).toBe("previous-bytes");
  });

  test("the published executable runs without the checkout node_modules", async () => {
    const directory = temp();
    const checkout = join(directory, "checkout");
    mkdirSync(checkout);
    const compiled = join(directory, "compiled");
    await compileMcp(join(import.meta.dir, ".."), compiled);
    const destination = await publishMcp(checkout, async (outfile) => {
      cpSync(compiled, outfile);
    });

    const child = spawn(destination, ["--help"], {
      cwd: directory,
      env: { PATH: "/usr/bin:/bin", HOME: directory },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output: Buffer[] = [];
    child.stdout?.on("data", (chunk: Buffer) => output.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => output.push(chunk));
    const code = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve(null);
      }, 500);
      child.on("exit", (status) => {
        clearTimeout(timer);
        resolve(status);
      });
    });
    const text = Buffer.concat(output).toString();
    expect(`${text}\n${code ?? "running"}`).not.toMatch(/Cannot find module|MODULE_NOT_FOUND/);
  }, 120_000);
});

process.on("exit", () => {
  for (const directory of roots) {
    rmSync(directory, { recursive: true, force: true });
  }
});
