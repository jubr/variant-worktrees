/**
 * Specification: openspec/specs/variant-cli/global-options/spec.md
 */
import { describe, expect, it } from "bun:test";
import { takeSlug } from "./slug-flag.js";

describe("global slug option", () => {
  it("takes -s after the command", () => {
    expect(takeSlug(["create", "-s", "preview-one"])).toEqual({ args: ["create"], slug: "preview-one" });
  });

  it("takes -s before the command", () => {
    expect(takeSlug(["-s", "preview-one", "create"])).toEqual({ args: ["create"], slug: "preview-one" });
  });

  it("takes --slug with a value and with =", () => {
    expect(takeSlug(["--slug", "preview-one", "create"])).toEqual({ args: ["create"], slug: "preview-one" });
    expect(takeSlug(["create", "--slug=preview-one", "--detach"])).toEqual({
      args: ["create", "--detach"],
      slug: "preview-one",
    });
  });

  it("leaves the arguments alone without a slug", () => {
    expect(takeSlug(["list", "--json"])).toEqual({ args: ["list", "--json"] });
  });

  it("fails when the slug has no value", () => {
    expect(() => takeSlug(["create", "-s"])).toThrow(/-s requires a slug/);
    expect(() => takeSlug(["create", "--slug"])).toThrow(/--slug requires a slug/);
    expect(() => takeSlug(["create", "--slug="])).toThrow(/--slug requires a slug/);
    expect(() => takeSlug(["create", "-s", "--detach"])).toThrow(/-s requires a slug/);
  });
});
