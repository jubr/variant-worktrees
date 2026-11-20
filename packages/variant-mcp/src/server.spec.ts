/**
 * Specification: openspec/specs/variant-cli/mcp-command/spec.md
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { runMcpServer } from "./server.js";

describe("runMcpServer", () => {
  it("rejects an unknown option before any server starts", async () => {
    await expect(runMcpServer({ args: ["--nope"], version: "0.0.0" })).rejects.toThrow();
  });

  it("is a function that starts nothing on import", () => {
    expect(typeof runMcpServer).toBe("function");
  });

  it("is not a bin of the package", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      bin?: unknown;
    };

    expect(manifest.bin).toBeUndefined();
  });
});
