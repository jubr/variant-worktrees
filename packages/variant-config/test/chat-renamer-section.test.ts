import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, readChatRenamerConfig } from "../src/index.js";

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-chat-renamer-"));
const withDirectory = (run: (directory: string) => void): void => {
  const directory = tempDirectory();
  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("readChatRenamerConfig", () => {
  it("returns the section without needing database settings", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "chatRenamer:\n  renameExistingDays: 30\n");

      expect(readChatRenamerConfig(directory)).toEqual({ renameExistingDays: 30 });
    }));

  it("finds variants.yaml in a parent directory", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "chatRenamer:\n  trigger: hook\n");
      mkdirSync(join(directory, "a", "b"), { recursive: true });

      expect(readChatRenamerConfig(join(directory, "a", "b"))).toEqual({ trigger: "hook" });
    }));

  it("returns an empty section when the file has none", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  seed: ./seed.sh\n");

      expect(readChatRenamerConfig(directory)).toEqual({});
    }));

  it("returns an empty section when the file is invalid", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "chatRenamer:\n  renameExistingDays: -1\n");

      expect(readChatRenamerConfig(directory)).toEqual({});
    }));

  it("returns an empty section when no variants.yaml exists", () =>
    withDirectory((directory) => {
      expect(readChatRenamerConfig(directory)).toEqual({});
    }));
});

describe("readChatRenamerConfig titleEventPromptLines", () => {
  it("returns the limit", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "chatRenamer:\n  titleEventPromptLines: 20\n");

      expect(readChatRenamerConfig(directory)).toEqual({ titleEventPromptLines: 20 });
    }));

  it("returns an empty section for a limit of 0", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "chatRenamer:\n  titleEventPromptLines: 0\n");

      expect(readChatRenamerConfig(directory)).toEqual({});
    }));
});

describe("loadConfig", () => {
  it("carries the chatRenamer section through", () =>
    withDirectory((directory) => {
      writeFileSync(join(directory, "variants.yaml"), "chatRenamer:\n  hookScope: user\n");

      expect(loadConfig({ cwd: directory }).chatRenamer).toEqual({ hookScope: "user" });
    }));
});
