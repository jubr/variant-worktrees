import { describe, expect, it } from "bun:test";
import * as shared from "chat-renamer-config";

import { DEFAULT_ACTIVATION_PATTERNS } from "./chat-rename-patterns";
import { DEFAULT_WORKTREE_PREFIXES, readTriggerSettings } from "./chat-rename-settings";

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
      awakeWhen: "chatsActive",
      awakeCmd: "caffeinate -disu -w ${extensionHostPid}",
      graceDelaySecs: 60,
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
      awakeWhen: "chatsActive",
      awakeCmd: "caffeinate -disu -w ${extensionHostPid}",
      graceDelaySecs: 60,
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
      awakeWhen: "chatsActive",
      awakeCmd: "caffeinate -disu -w ${extensionHostPid}",
      graceDelaySecs: 60,
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

  it("defaults awake to chatsActive, the detected caffeinate command, and 60 seconds", () => {
    expect(readTriggerSettings(settings({}))).toMatchObject({
      awakeWhen: "chatsActive",
      awakeCmd: "caffeinate -disu -w ${extensionHostPid}",
      graceDelaySecs: 60,
    });
  });

  it("reads awake values and falls back when they are unknown", () => {
    expect(
      readTriggerSettings(
        settings({
          "awake.when": "never",
          "awake.cmd": "caffeinate -disu -w ${extensionHostPid}",
          "awake.graceDelaySecs": 0,
        }),
      ),
    ).toMatchObject({
      awakeWhen: "never",
      awakeCmd: "caffeinate -disu -w ${extensionHostPid}",
      graceDelaySecs: 0,
    });
    expect(
      readTriggerSettings(settings({ "awake.when": "always", "awake.cmd": "  ", "awake.graceDelaySecs": -1 })),
    ).toMatchObject({
      awakeWhen: "chatsActive",
      awakeCmd: "caffeinate -disu -w ${extensionHostPid}",
      graceDelaySecs: 60,
    });
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
