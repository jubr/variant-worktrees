import { describe, expect, it } from "bun:test";
import type { LogEvent } from "variant-api";
import { formatVariantLog } from "./format-log.ts";

const event = (message: string, slug?: string): LogEvent =>
  slug === undefined ? { level: "info", message } : { level: "info", message, slug };

describe("vscode log lines", () => {
  it("renders a mise command with the slug first and the command as cmd", () => {
    expect(formatVariantLog(event("[create] + mise install", "add-auth"))).toBe(
      '<add-auth> [create] cmd="mise install"',
    );
  });

  it("puts a leading bracketed slug first on every other line that has one", () => {
    expect(formatVariantLog(event("[demo] [provision] create schema app"))).toBe(
      "<demo> [provision] create schema app",
    );
  });

  it("leaves a line with no slug unchanged", () => {
    expect(formatVariantLog(event("listed variants"))).toBe("listed variants");
  });
});
