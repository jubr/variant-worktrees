import { join } from "node:path";

import {
  DEFAULT_HOOK_SCOPE,
  DEFAULT_RENAME_EXISTING_DAYS,
  DEFAULT_TITLE_EVENT_PROMPT_LINES,
  DEFAULT_TRIGGER,
  DEFAULT_WORKTREE_PREFIXES,
  type HookScope,
  isHookScope,
  isPromptLineLimit,
  isRenameExistingDays,
  isTrigger,
  type Trigger,
} from "chat-renamer-config";

import { DEFAULT_ACTIVATION_PATTERNS } from "./chat-rename-patterns";

/** The defaults live in chat-renamer-config, which owns the full set of options. */
export { DEFAULT_RENAME_EXISTING_DAYS, DEFAULT_TITLE_EVENT_PROMPT_LINES, DEFAULT_WORKTREE_PREFIXES, type HookScope };

export type ChatRenameTrigger = Trigger;

export type TriggerSettings = {
  trigger: ChatRenameTrigger;
  hookScope: HookScope;
  activationPatterns: string[];
  /** Prefixes of worktree directories whose dragged-in path names a chat. Empty turns the derivation off. */
  worktreePrefixes: string[];
  /** Rename existing chats created within this many days, oldest first. 0 turns it off. */
  renameExistingDays: number;
  /** Lines of a new chat's first prompt the title event tests for a rename request. At least 1. */
  titleEventPromptLines: number;
};

/** Normalises raw configuration values. Unknown values fall back to the defaults. */
export const readTriggerSettings = (get: (key: string) => unknown): TriggerSettings => {
  const patterns = get("activationPatterns");
  const prefixes = get("worktreePrefixes");
  const days = get("renameExistingDays");
  const promptLines = get("titleEventPromptLines");
  const trigger = get("trigger");
  const hookScope = get("hookScope");
  return {
    trigger: isTrigger(trigger) ? trigger : DEFAULT_TRIGGER,
    hookScope: isHookScope(hookScope) ? hookScope : DEFAULT_HOOK_SCOPE,
    activationPatterns: Array.isArray(patterns)
      ? patterns.filter((entry): entry is string => typeof entry === "string")
      : [...DEFAULT_ACTIVATION_PATTERNS],
    worktreePrefixes: Array.isArray(prefixes)
      ? prefixes.filter((entry): entry is string => typeof entry === "string")
      : [...DEFAULT_WORKTREE_PREFIXES],
    renameExistingDays: isRenameExistingDays(days) ? days : DEFAULT_RENAME_EXISTING_DAYS,
    titleEventPromptLines: isPromptLineLimit(promptLines) ? promptLines : DEFAULT_TITLE_EVENT_PROMPT_LINES,
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
