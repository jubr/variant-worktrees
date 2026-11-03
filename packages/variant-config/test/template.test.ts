import { describe, expect, it } from "bun:test";
import { renderTemplate } from "../src/template.js";

/** Specification: openspec/specs/variant-config/core/spec.md (Interpolation in every setting) */
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

    expect(renderTemplate("${slug}-${port}", context)).toBe("demo-62060");
    expect(renderTemplate("${schema} ${storage} ${worktree} ${url}", context)).toBe(
      "v_demo /w/.storage /w http://demo.vw.localhost:62060",
    );
  });

  it("replaces ${abbr} with the project abbreviation", () => {
    expect(renderTemplate("http://${abbr}-${slug}.localhost", { abbr: "otc", slug: "demo" })).toBe(
      "http://otc-demo.localhost",
    );
  });

  it("replaces the port of another watch by its key", () => {
    expect(renderTemplate("${be.port}", { ports: { be: 62061 } })).toBe("62061");
    expect(renderTemplate("${my-api.port}", { ports: { "my-api": 62062 } })).toBe("62062");
  });

  it("fails naming a watch that has no port", () => {
    expect(() => renderTemplate("${nope.port}", { ports: { be: 62061 } })).toThrow("nope");
  });

  it("fails on the former ${port.<key>} form, naming ${<key>.port}", () => {
    expect(() => renderTemplate("${port.be}", { ports: { be: 62061 } })).toThrow("${be.port}");
  });

  it("leaves a placeholder without a value empty", () => {
    expect(renderTemplate("[${port}][${storage}][${url}]", { slug: "demo" })).toBe("[][][]");
  });

  it("replaces ${NAME} from the environment", () => {
    expect(renderTemplate("${JWT_SECRET}", { env: { JWT_SECRET: "s3cret" } })).toBe("s3cret");
  });

  it("uses the default of ${NAME:-default} with a nested variant placeholder when NAME is unset", () => {
    expect(renderTemplate("${JWT_SECRET:-local-${slug}}", { slug: "demo", env: {} })).toBe("local-demo");
  });

  it("prefers the environment value over the default", () => {
    expect(renderTemplate("${JWT_SECRET:-local}", { env: { JWT_SECRET: "s3cret" } })).toBe("s3cret");
  });

  it("uses the default for an empty variable", () => {
    expect(renderTemplate("${JWT_SECRET:-local}", { env: { JWT_SECRET: "" } })).toBe("local");
  });

  it("allows an empty default", () => {
    expect(renderTemplate("a${OPT:-}b", { env: {} })).toBe("ab");
  });

  it("fails on an unset variable without a default, naming it", () => {
    expect(() => renderTemplate("${MISSING_VAR}", { env: {} })).toThrow("MISSING_VAR");
  });

  it("names the setting in the failure", () => {
    expect(() => renderTemplate("${MISSING_VAR}", { env: {}, setting: "db.password" })).toThrow(
      /MISSING_VAR.*db\.password/,
    );
  });

  it("reads a lazy environment only when a variable is referenced", () => {
    let reads = 0;
    const env = (): NodeJS.ProcessEnv => {
      reads += 1;
      return { HOME_DIR: "/home/me" };
    };

    expect(renderTemplate("${slug}", { slug: "demo", env })).toBe("demo");
    expect(reads).toBe(0);
    expect(renderTemplate("${HOME_DIR}/${HOME_DIR}", { env })).toBe("/home/me//home/me");
    expect(reads).toBe(1);
  });

  it("stands $${ for a literal ${ that a shell must see", () => {
    expect(renderTemplate("echo $${HOME}", { env: {} })).toBe("echo ${HOME}");
    expect(renderTemplate("$${slug} ${slug}", { slug: "demo" })).toBe("${slug} demo");
  });

  it("lets a placeholder win over an environment variable of the same spelling", () => {
    expect(renderTemplate("${slug}", { slug: "demo", env: { slug: "env" } })).toBe("demo");
  });

  it("fails on a variant placeholder in a setting that has no variant", () => {
    expect(() => renderTemplate("${slug}", { variant: false, setting: "db.schema" })).toThrow(/slug.*db\.schema/);
  });

  it("leaves text that is no placeholder alone", () => {
    expect(renderTemplate("price: $5 {braces} {{double}} $ {x}", {})).toBe("price: $5 {braces} {{double}} $ {x}");
  });
});
