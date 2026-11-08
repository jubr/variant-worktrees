import { describe, expect, it } from "bun:test";
import type { LogEvent } from "variant-api";
import { formatVariantLog } from "./format-log.ts";

const event = (message: string, fields?: { slug?: string; step?: string }): LogEvent => ({
  level: "info",
  message,
  ...fields,
});

describe("vscode log lines", () => {
  it("renders a mise command with the slug first and the command as cmd", () => {
    expect(formatVariantLog(event("+ mise install", { step: "create", slug: "add-auth" }))).toBe(
      '<add-auth> [create] cmd="mise install"',
    );
  });

  it("puts the step and slug from the event on a provision line", () => {
    expect(formatVariantLog(event("create schema app", { step: "provision", slug: "demo" }))).toBe(
      "<demo> [provision] create schema app",
    );
  });

  it("leaves a line with no slug unchanged", () => {
    expect(formatVariantLog(event("listed variants"))).toBe("listed variants");
  });
});
