import { describe, expect, it } from "bun:test";
import * as shared from "chat-renamer-config";

import { DEFAULT_ACTIVATION_PATTERNS } from "./chat-rename-patterns";
import { DEFAULT_WORKTREE_PREFIX, hookCommand, readTriggerSettings, resolveCursorDir } from "./chat-rename-settings";

const HOOK_SCRIPT_NAME = "demo-chat-rename.sh";
const settings = (values: Record<string, unknown>) => (key: string) => values[key];

describe("shared defaults", () => {
  it("takes the worktree prefix from chat-renamer-config", () => {
    expect(DEFAULT_WORKTREE_PREFIX).toBe(shared.DEFAULT_WORKTREE_PREFIX);
  });
});

describe("readTriggerSettings", () => {
  it("defaults to the title event and a workspace hook scope", () => {
    expect(readTriggerSettings(settings({}))).toEqual({
      trigger: "titleEvent",
      hookScope: "workspace",
      activationPatterns: [...DEFAULT_ACTIVATION_PATTERNS],
      worktreePrefixes: ["_v"],
      renameExistingChats: true,
    });
  });

  it("accepts the documented values", () => {
    expect(
      readTriggerSettings(settings({ trigger: "hook", hookScope: "user", activationPatterns: ["^a$", "b"] })),
    ).toEqual({
      trigger: "hook",
      hookScope: "user",
      activationPatterns: ["^a$", "b"],
      worktreePrefixes: ["_v"],
      renameExistingChats: true,
    });
  });

  it("falls back to the defaults for unknown values", () => {
    expect(readTriggerSettings(settings({ trigger: "nope", hookScope: 3, activationPatterns: "x" }))).toEqual({
      trigger: "titleEvent",
      hookScope: "workspace",
      activationPatterns: [...DEFAULT_ACTIVATION_PATTERNS],
      worktreePrefixes: ["_v"],
      renameExistingChats: true,
    });
  });

  it("lets an empty list switch the patterns off and drops non-string entries", () => {
    expect(readTriggerSettings(settings({ activationPatterns: [] })).activationPatterns).toEqual([]);
    expect(readTriggerSettings(settings({ activationPatterns: ["a", 1, null] })).activationPatterns).toEqual(["a"]);
  });

  it("reads renameExistingChats, on unless explicitly false", () => {
    expect(readTriggerSettings(settings({})).renameExistingChats).toBe(true);
    expect(readTriggerSettings(settings({ renameExistingChats: false })).renameExistingChats).toBe(false);
    expect(readTriggerSettings(settings({ renameExistingChats: "no" })).renameExistingChats).toBe(true);
  });

  it("reads worktree prefixes, drops non-strings, and lets an empty list switch them off", () => {
    expect(readTriggerSettings(settings({ worktreePrefixes: ["_work", 1, "_v"] })).worktreePrefixes).toEqual([
      "_work",
      "_v",
    ]);
    expect(readTriggerSettings(settings({ worktreePrefixes: [] })).worktreePrefixes).toEqual([]);
    expect(readTriggerSettings(settings({ worktreePrefixes: "_work" })).worktreePrefixes).toEqual(["_v"]);
  });
});

describe("resolveCursorDir", () => {
  it("uses the workspace .cursor folder for the workspace scope", () => {
    expect(resolveCursorDir("workspace", "/repo", "/home/me")).toBe("/repo/.cursor");
  });

  it("uses ~/.cursor for the user scope", () => {
    expect(resolveCursorDir("user", "/repo", "/home/me")).toBe("/home/me/.cursor");
  });

  it("falls back to ~/.cursor when no workspace folder is open", () => {
    expect(resolveCursorDir("workspace", undefined, "/home/me")).toBe("/home/me/.cursor");
  });
});

describe("hookCommand", () => {
  it("is relative to the project root for workspace hooks", () => {
    expect(hookCommand("/repo/.cursor", "/repo", HOOK_SCRIPT_NAME)).toBe(`.cursor/hooks/${HOOK_SCRIPT_NAME}`);
  });

  it("is absolute for user hooks", () => {
    expect(hookCommand("/home/me/.cursor", undefined, HOOK_SCRIPT_NAME)).toBe(
      `/home/me/.cursor/hooks/${HOOK_SCRIPT_NAME}`,
    );
  });
});
