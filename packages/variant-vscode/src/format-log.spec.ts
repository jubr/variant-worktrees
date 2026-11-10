import { describe, expect, it } from "bun:test";
import { type LogEvent, LogLevel } from "variant-api";
import { formatVariantLog } from "./format-log.ts";

const event = (message: string, fields?: { slug?: string; step?: string }): LogEvent => ({
  level: LogLevel.info,
  message,
  ...fields,
});

describe("vscode log lines", () => {
  it("renders a quoted shell command with the slug and step and no cmd=", () => {
    const line = formatVariantLog(event('+"mise install"', { step: "create", slug: "add-auth" }));
    expect(line).toBe('<add-auth> [create] +"mise install"');
    expect(line).not.toContain("cmd=");
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
