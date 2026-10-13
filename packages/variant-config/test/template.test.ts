import { describe, expect, it } from "bun:test";
import { renderTemplate } from "../src/template.js";

describe("renderTemplate", () => {
  it("replaces the variant placeholders", () => {
    const context = {
      slug: "demo",
      schema: "v_demo",
      storage: "/w/.storage",
      worktree: "/w",
      url: "http://demo.vw.localhost:62060",
      port: 62060,
    };

    expect(renderTemplate("{{slug}}-{{port}}", context)).toBe("demo-62060");
    expect(renderTemplate("{{schema}} {{storage}} {{worktree}} {{url}}", context)).toBe(
      "v_demo /w/.storage /w http://demo.vw.localhost:62060",
    );
  });

  it("replaces the port of another instance by its key", () => {
    expect(renderTemplate("{{port.be}}", { ports: { be: 62061 } })).toBe("62061");
  });

  it("fails naming an instance that has no port", () => {
    expect(() => renderTemplate("{{port.nope}}", { ports: { be: 62061 } })).toThrow("nope");
  });

  it("leaves a placeholder without a value empty", () => {
    expect(renderTemplate("[{{port}}][{{storage}}][{{url}}]", { slug: "demo" })).toBe("[][][]");
  });

  it("replaces {{NAME}} from the environment", () => {
    expect(renderTemplate("{{JWT_SECRET}}", { env: { JWT_SECRET: "s3cret" } })).toBe("s3cret");
  });

  it("uses the default of {{NAME:-default}} with a nested variant placeholder when NAME is unset", () => {
    expect(renderTemplate("{{JWT_SECRET:-local-{{slug}}}}", { slug: "demo", env: {} })).toBe("local-demo");
  });

  it("prefers the environment value over the default", () => {
    expect(renderTemplate("{{JWT_SECRET:-local}}", { env: { JWT_SECRET: "s3cret" } })).toBe("s3cret");
  });

  it("uses the default for an empty variable", () => {
    expect(renderTemplate("{{JWT_SECRET:-local}}", { env: { JWT_SECRET: "" } })).toBe("local");
  });

  it("allows an empty default", () => {
    expect(renderTemplate("a{{OPT:-}}b", { env: {} })).toBe("ab");
  });

  it("fails on an unset variable without a default, naming it", () => {
    expect(() => renderTemplate("{{MISSING_VAR}}", { env: {} })).toThrow("MISSING_VAR");
  });
});
