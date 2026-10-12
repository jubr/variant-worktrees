import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chatRenamerConfigFor } from "./renamer-config.ts";

const inWorkspace = (yaml: string | undefined, run: (directory: string) => void): void => {
  const directory = mkdtempSync(join(tmpdir(), "variant-vscode-renamer-"));
  try {
    if (yaml !== undefined) {
      writeFileSync(join(directory, "variants.yaml"), yaml);
    }
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("chatRenamerConfigFor", () => {
  it("recognises the workspace's variant.prefix as a worktree prefix", () =>
    inWorkspace("variant:\n  prefix: _work-\n", (directory) => {
      expect(chatRenamerConfigFor(directory)).toEqual({ worktreePrefixes: ["_work-"] });
    }));

  it("falls back to the default variant prefix without a variants.yaml", () =>
    inWorkspace(undefined, (directory) => {
      expect(chatRenamerConfigFor(directory)).toEqual({ worktreePrefixes: ["_v-"] });
    }));

  it("keeps the other options of the chatRenamer section", () =>
    inWorkspace("chatRenamer:\n  renameExistingDays: 30\n  trigger: hook\n", (directory) => {
      expect(chatRenamerConfigFor(directory)).toEqual({
        worktreePrefixes: ["_v-"],
        renameExistingDays: 30,
        trigger: "hook",
      });
    }));

  it("lets chatRenamer.worktreePrefixes replace the variant prefix", () =>
    inWorkspace("variant:\n  prefix: _work-\nchatRenamer:\n  worktreePrefixes: [_wt-]\n", (directory) => {
      expect(chatRenamerConfigFor(directory)).toEqual({ worktreePrefixes: ["_wt-"] });
    }));

  it("lets an empty chatRenamer.worktreePrefixes switch the derivation off", () =>
    inWorkspace("chatRenamer:\n  worktreePrefixes: []\n", (directory) => {
      expect(chatRenamerConfigFor(directory)).toEqual({ worktreePrefixes: [] });
    }));

  it("returns nothing when no workspace folder is open", () => {
    expect(chatRenamerConfigFor(undefined)).toEqual({});
  });
});
