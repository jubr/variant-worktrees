import { describe, expect, it } from "bun:test";
import * as shared from "chat-renamer-config";

import { DEFAULT_ACTIVATION_PATTERNS } from "./chat-rename-patterns";
import { DEFAULT_WORKTREE_PREFIXES, hookCommand, readTriggerSettings, resolveCursorDir } from "./chat-rename-settings";

const HOOK_SCRIPT_NAME = "demo-chat-rename.sh";
const settings = (values: Record<string, unknown>) => (key: string) => values[key];

describe("shared defaults", () => {
  it("takes the worktree prefixes from chat-renamer-config", () => {
    expect(DEFAULT_WORKTREE_PREFIXES).toBe(shared.DEFAULT_WORKTREE_PREFIXES);
  });
});

describe("readTriggerSettings", () => {
  it("defaults to the title event and a workspace hook scope", () => {
    expect(readTriggerSettings(settings({}))).toEqual({
      trigger: "titleEvent",
      hookScope: "workspace",
      activationPatterns: [...DEFAULT_ACTIVATION_PATTERNS],
      worktreePrefixes: [],
      renameExistingDays: 7,
      titleEventPromptLines: 10,
    });
  });

  it("accepts the documented values", () => {
    expect(
      readTriggerSettings(settings({ trigger: "hook", hookScope: "user", activationPatterns: ["^a$", "b"] })),
    ).toEqual({
      trigger: "hook",
      hookScope: "user",
      activationPatterns: ["^a$", "b"],
      worktreePrefixes: [],
      renameExistingDays: 7,
      titleEventPromptLines: 10,
    });
  });

  it("falls back to the defaults for unknown values", () => {
    expect(readTriggerSettings(settings({ trigger: "nope", hookScope: 3, activationPatterns: "x" }))).toEqual({
      trigger: "titleEvent",
      hookScope: "workspace",
      activationPatterns: [...DEFAULT_ACTIVATION_PATTERNS],
      worktreePrefixes: [],
      renameExistingDays: 7,
      titleEventPromptLines: 10,
    });
  });

  it("lets an empty list switch the patterns off and drops non-string entries", () => {
    expect(readTriggerSettings(settings({ activationPatterns: [] })).activationPatterns).toEqual([]);
    expect(readTriggerSettings(settings({ activationPatterns: ["a", 1, null] })).activationPatterns).toEqual(["a"]);
  });

  it("reads renameExistingDays, default 7, 0 turns it off", () => {
    expect(readTriggerSettings(settings({})).renameExistingDays).toBe(7);
    expect(readTriggerSettings(settings({ renameExistingDays: 30 })).renameExistingDays).toBe(30);
    expect(readTriggerSettings(settings({ renameExistingDays: 0 })).renameExistingDays).toBe(0);
  });

  it("falls back to 7 days for an invalid window", () => {
    for (const value of [-1, 1.5, "7", true, null]) {
      expect(readTriggerSettings(settings({ renameExistingDays: value })).renameExistingDays).toBe(7);
    }
  });

  it("reads titleEventPromptLines, default 10", () => {
    expect(readTriggerSettings(settings({})).titleEventPromptLines).toBe(10);
    expect(readTriggerSettings(settings({ titleEventPromptLines: 20 })).titleEventPromptLines).toBe(20);
    expect(readTriggerSettings(settings({ titleEventPromptLines: 1 })).titleEventPromptLines).toBe(1);
  });

  it("falls back to 10 lines for an invalid limit", () => {
    for (const value of [0, -3, 2.5, "many", true, null]) {
      expect(readTriggerSettings(settings({ titleEventPromptLines: value })).titleEventPromptLines).toBe(10);
    }
  });

  it("reads worktree prefixes, drops non-strings, and lets an empty list switch them off", () => {
    expect(readTriggerSettings(settings({ worktreePrefixes: ["_work-", 1, "_v-"] })).worktreePrefixes).toEqual([
      "_work-",
      "_v-",
    ]);
    expect(readTriggerSettings(settings({ worktreePrefixes: [] })).worktreePrefixes).toEqual([]);
    expect(readTriggerSettings(settings({ worktreePrefixes: "_work" })).worktreePrefixes).toEqual([]);
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
