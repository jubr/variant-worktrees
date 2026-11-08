import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as api from "../src/index.js";

describe("public exports", () => {
  it("exports redacted for renderers outside the library", () => {
    expect(api.redacted({ db: { password: "secret", user: "me" } })).toEqual({ db: { password: "***", user: "me" } });
  });

  it("exports the log sink a host attaches", () => {
    expect(api.setLogSink).toBeFunction();
    expect(api.log).toBeFunction();
    expect(api.logT).toBeFunction();
    expect(api.logD).toBeFunction();
    expect(api.logI).toBeFunction();
    expect(api.logW).toBeFunction();
    expect(api.logE).toBeFunction();
    expect(api.LOG_LEVELS).toEqual(["trace", "debug", "info", "warn", "error"]);
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
