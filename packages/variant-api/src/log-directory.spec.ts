import { describe, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { LogLevel } from "variant-log";
import { levelForDirectory } from "./log-directory.ts";

const underTmp = (directory: string): boolean => {
  const real = realpathSync(directory);
  return (
    directory === "/tmp" ||
    directory.startsWith("/tmp/") ||
    real === "/tmp" ||
    real.startsWith("/tmp/") ||
    real === "/private/tmp" ||
    real.startsWith("/private/tmp/")
  );
};

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

  it("keeps warn for a user temp directory that is not /tmp", () => {
    expect(levelForDirectory(LogLevel.warn, "/var/folders/ab/cd")).toBe(LogLevel.warn);
    expect(levelForDirectory(LogLevel.debug, "/var/tmp/variant-app")).toBe(LogLevel.debug);
  });

  it("keeps the requested level when the process temp directory is not /tmp", () => {
    const directory = realpathSync(tmpdir());
    if (underTmp(directory)) {
      expect(levelForDirectory(LogLevel.info, directory)).toBe(LogLevel.trace);
      return;
    }
    expect(levelForDirectory(LogLevel.info, directory)).toBe(LogLevel.info);
  });
});
