/**
 * Specification: openspec/specs/meta/ci-feature-builds/spec.md (Branch builds report the slim runtime and executable sizes)
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { slimSummary } from "./slim-summary.ts";

const KB = 1024;

describe("slimSummary", () => {
  test("names the release and gives the runtime and the variant in KB", () => {
    const table = slimSummary({ target: "bun-linux-x64", release: "bun-slim-v1.4.5-1", slim: 87_000 * KB, variant: 91_234 * KB });

    expect(table).toContain("### bun-linux-x64");
    expect(table).toContain("| bun-slim | bun-slim (KB) | variant (KB) |");
    expect(table).toContain("| bun-slim-v1.4.5-1 | 87,000 | 91,234 |");
  });

  test("shows a dash for the release and the runtime when they are unknown", () => {
    const table = slimSummary({ target: "bun-linux-x64", variant: 91_234 * KB });

    expect(table).toContain("| – | – | 91,234 |");
  });
});

describe("slim-summary script", () => {
  const run = (cache: (root: string) => void) => {
    const root = mkdtempSync(join(tmpdir(), "slim-summary-"));
    try {
      cache(root);
      const variant = join(root, "variant");
      writeFileSync(variant, Buffer.alloc(3 * KB));
      return spawnSync("bun", [join(import.meta.dir, "slim-summary.ts"), "bun-linux-x64", variant, root], {
        encoding: "utf8",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };

  test("reads the release from the directory of the cached runtime", () => {
    const result = run((root) => {
      const directory = join(root, ".cache", "bun-slim", "linux-x64", "bun-slim-linux-x64-v1.4.5-1");
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "bun-slim"), Buffer.alloc(2 * KB));
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("| bun-slim-v1.4.5-1 | 2 | 3 |");
  });

  test("still succeeds without a cached runtime", () => {
    const result = run(() => {});

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("| – | – | 3 |");
  });
});
