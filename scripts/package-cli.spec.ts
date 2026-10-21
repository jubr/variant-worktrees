/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release contents)
 */
import { describe, expect, test } from "bun:test";
import { assetName } from "./package-cli.ts";

describe("package-cli assetName", () => {
  test("names a unix executable with version, os and arch", () => {
    expect(assetName("1.2.3", "bun-linux-x64")).toBe("variant-1.2.3-linux-x64");
    expect(assetName("1.2.3", "bun-darwin-arm64")).toBe("variant-1.2.3-darwin-arm64");
  });

  test("gives Windows executables an .exe suffix", () => {
    expect(assetName("1.2.3", "bun-windows-x64")).toBe("variant-1.2.3-windows-x64.exe");
    expect(assetName("1.2.3", "bun-windows-arm64")).toBe("variant-1.2.3-windows-arm64.exe");
  });

  test("rejects a target that is not a release platform", () => {
    expect(() => assetName("1.2.3", "bun-linux-x64-baseline")).toThrow("unsupported target");
    expect(() => assetName("1.2.3", "bun-freebsd-x64")).toThrow("unsupported target");
  });
});
