/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release executables report their sizes)
 */
import { describe, expect, test } from "bun:test";
import { distAsset, sizeSummary } from "./runtime-sizes.ts";

const KB = 1024;

describe("distAsset", () => {
  test("names the zip of the runtime that ships with Bun, which calls arm64 aarch64", () => {
    expect(distAsset("bun-linux-x64")).toBe("bun-linux-x64.zip");
    expect(distAsset("bun-linux-arm64")).toBe("bun-linux-aarch64.zip");
    expect(distAsset("bun-darwin-arm64")).toBe("bun-darwin-aarch64.zip");
    expect(distAsset("bun-windows-x64")).toBe("bun-windows-x64.zip");
  });
});

describe("sizeSummary", () => {
  test("tables KB sizes: runtimes, the saving, the code bundle, and the saving of the whole executable", () => {
    const summary = sizeSummary({
      target: "bun-linux-x64",
      dist: 90_000 * KB,
      slim: 50_000 * KB,
      variant: 54_000 * KB,
    });

    expect(summary).toBe(
      [
        "### bun-linux-x64",
        "",
        "| bun-dist (KB) | bun-slim (KB) | smaller | added code bundle (KB) | bun-dist + code bundle (KB) | variant-cli (KB) | smaller |",
        "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        "| 90,000 | 50,000 | 44.4% | 4,000 | 94,000 | 54,000 | 42.6% |",
        "",
      ].join("\n"),
    );
  });

  test("shows no slim runtime as a dash and the code bundle against the default runtime", () => {
    const summary = sizeSummary({ target: "bun-windows-x64", dist: 100_000 * KB, variant: 104_000 * KB });

    expect(summary).toContain("| 100,000 | – | – | 4,000 | 104,000 | 104,000 | 0.0% |");
  });

  test("shows dashes for what it cannot compute when the default runtime is unknown", () => {
    const summary = sizeSummary({ target: "bun-darwin-arm64", slim: 47_000 * KB, variant: 51_000 * KB });

    expect(summary).toContain("| – | 47,000 | – | 4,000 | – | 51,000 | – |");
  });

  test("shows only the executable when no runtime is known", () => {
    expect(sizeSummary({ target: "bun-linux-arm64", variant: 51_000 * KB })).toContain("| – | – | – | – | – | 51,000 | – |");
  });
});
