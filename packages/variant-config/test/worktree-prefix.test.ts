import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readWorktreePrefix } from "../src/index.js";

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-prefix-"));

describe("readWorktreePrefix", () => {
  it("returns the configured prefix without needing database settings", () => {
    const directory = tempDirectory();
    try {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  worktreePrefix: _work\n");

      expect(readWorktreePrefix(directory)).toBe("_work");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("finds variants.yaml in a parent directory", () => {
    const directory = tempDirectory();
    try {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  worktreePrefix: _work\n");
      mkdirSync(join(directory, "a", "b"), { recursive: true });

      expect(readWorktreePrefix(join(directory, "a", "b"))).toBe("_work");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("returns _v when the file does not set a prefix", () => {
    const directory = tempDirectory();
    try {
      writeFileSync(join(directory, "variants.yaml"), "seed: ./seed.sh\n");

      expect(readWorktreePrefix(directory)).toBe("_v");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("returns _v when the file is invalid", () => {
    const directory = tempDirectory();
    try {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  worktreePrefix: a/b\n");

      expect(readWorktreePrefix(directory)).toBe("_v");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("returns _v when no variants.yaml exists above the directory", () => {
    const directory = tempDirectory();
    try {
      expect(readWorktreePrefix(directory)).toBe("_v");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
