import { describe, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { LogLevel } from "variant-log";
import { levelForDirectory } from "./log-directory.ts";

describe("known temporary directory", () => {
  it("forces trace for a directory inside /tmp", () => {
    expect(levelForDirectory(LogLevel.info, "/tmp/variant-app")).toBe(LogLevel.trace);
  });

  it("forces trace for a directory inside the /tmp symlink target", () => {
    const target = realpathSync("/tmp");
    expect(levelForDirectory(LogLevel.warn, `${target}/variant-app`)).toBe(LogLevel.trace);
  });

  it("keeps the requested level outside /tmp", () => {
    expect(levelForDirectory(LogLevel.info, "/work/demo")).toBe(LogLevel.info);
  });

  it("forces trace for /var/folders, /var/tmp, and the process temp directory", () => {
    expect(levelForDirectory(LogLevel.warn, "/var/folders/ab/cd")).toBe(LogLevel.trace);
    expect(levelForDirectory(LogLevel.debug, "/var/tmp/variant-app")).toBe(LogLevel.trace);
    expect(levelForDirectory(LogLevel.info, realpathSync(tmpdir()))).toBe(LogLevel.trace);
  });
});
