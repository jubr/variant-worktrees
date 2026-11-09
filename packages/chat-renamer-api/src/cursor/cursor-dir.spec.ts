import { describe, expect, it } from "bun:test";

import { hookCommand, resolveCursorDir } from "./cursor-dir";

const HOOK_SCRIPT_NAME = "demo-chat-rename.sh";

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
