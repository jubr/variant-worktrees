import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chatRenamerConfigFor, worktreePrefixesFor } from "./worktree-prefixes.ts";

describe("worktreePrefixesFor", () => {
  it("adds the variant.prefix of the workspace's variants.yaml", () => {
    const directory = mkdtempSync(join(tmpdir(), "variant-vscode-prefix-"));
    try {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");

      expect(worktreePrefixesFor(directory)).toEqual(["_work-"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("falls back to _v- without a variants.yaml", () => {
    const directory = mkdtempSync(join(tmpdir(), "variant-vscode-prefix-"));
    try {
      expect(worktreePrefixesFor(directory)).toEqual(["_v-"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("adds nothing when no workspace folder is open", () => {
    expect(worktreePrefixesFor(undefined)).toEqual([]);
  });
});

describe("chatRenamerConfigFor", () => {
  it("returns the chatRenamer section of the workspace's variants.yaml", () => {
    const directory = mkdtempSync(join(tmpdir(), "variant-vscode-renamer-"));
    try {
      writeFileSync(join(directory, "variants.yaml"), "chatRenamer:\n  renameExistingDays: 30\n  trigger: hook\n");

      expect(chatRenamerConfigFor(directory)).toEqual({ renameExistingDays: 30, trigger: "hook" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("returns an empty section without a variants.yaml", () => {
    const directory = mkdtempSync(join(tmpdir(), "variant-vscode-renamer-"));
    try {
      expect(chatRenamerConfigFor(directory)).toEqual({});
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("returns an empty section when no workspace folder is open", () => {
    expect(chatRenamerConfigFor(undefined)).toEqual({});
  });
});
