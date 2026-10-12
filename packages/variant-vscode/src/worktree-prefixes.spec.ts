import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { worktreePrefixesFor } from "./worktree-prefixes.ts";

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
