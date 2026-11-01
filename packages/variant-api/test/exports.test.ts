import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as api from "../src/index.js";

describe("public exports", () => {
  it("exports redacted for renderers outside the library", () => {
    expect(api.redacted({ db: { password: "secret", user: "me" } })).toEqual({ db: { password: "***", user: "me" } });
  });
});

describe("package manifest", () => {
  const manifest = JSON.parse(readFileSync(join(import.meta.dir, "../package.json"), "utf8")) as Record<
    string,
    unknown
  >;

  it("provides no executable", () => {
    expect(manifest.bin).toBeUndefined();
  });

  it("does not depend on the command-line parser", () => {
    expect(Object.keys(manifest.dependencies as Record<string, string>)).not.toContain("cleye");
  });
});
