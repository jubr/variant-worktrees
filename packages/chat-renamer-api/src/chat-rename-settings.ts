import { join } from "node:path";

import { DEFAULT_ACTIVATION_PATTERNS } from "./chat-rename-patterns";

export type ChatRenameTrigger = "titleEvent" | "hook";
export type HookScope = "workspace" | "user";

export type TriggerSettings = {
  trigger: ChatRenameTrigger;
  hookScope: HookScope;
  activationPatterns: string[];
};

/** Normalises raw configuration values. Unknown values fall back to the defaults. */
export const readTriggerSettings = (get: (key: string) => unknown): TriggerSettings => {
  const patterns = get("activationPatterns");
  return {
    trigger: get("trigger") === "hook" ? "hook" : "titleEvent",
    hookScope: get("hookScope") === "user" ? "user" : "workspace",
    activationPatterns: Array.isArray(patterns)
      ? patterns.filter((entry): entry is string => typeof entry === "string")
      : [...DEFAULT_ACTIVATION_PATTERNS],
  };
};

/** The `.cursor` folder that holds hooks.json. Workspace scope without an open folder falls back to the user folder. */
export const resolveCursorDir = (scope: HookScope, workspaceRoot: string | undefined, home: string): string =>
  scope === "workspace" && workspaceRoot ? join(workspaceRoot, ".cursor") : join(home, ".cursor");

/** Project hooks run from the project root, so they use a relative command. User hooks use an absolute path. */
export const hookCommand = (cursorDir: string, workspaceRoot: string | undefined, scriptName: string): string =>
  workspaceRoot && cursorDir === join(workspaceRoot, ".cursor")
    ? `.cursor/hooks/${scriptName}`
    : join(cursorDir, "hooks", scriptName);
