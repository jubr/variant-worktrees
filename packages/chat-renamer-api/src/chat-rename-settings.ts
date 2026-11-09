import {
  type AwakeWhat,
  type AwakeWhen,
  DEFAULT_AWAKE_GRACE_DELAY_SECS,
  DEFAULT_AWAKE_WHAT,
  DEFAULT_AWAKE_WHEN,
  DEFAULT_HOOK_SCOPE,
  DEFAULT_RENAME_EXISTING_DAYS,
  DEFAULT_TITLE_EVENT_PROMPT_LINES,
  DEFAULT_TRIGGER,
  DEFAULT_WORKTREE_PREFIXES,
  type HookScope,
  isAwakeGraceDelaySecs,
  isAwakeWhat,
  isAwakeWhen,
  isHookScope,
  isPromptLineLimit,
  isRenameExistingDays,
  isTrigger,
  type Trigger,
} from "chat-renamer-config";

import { DEFAULT_ACTIVATION_PATTERNS } from "./chat-rename-patterns";

/** The defaults live in chat-renamer-config, which owns the full set of options. */
export {
  DEFAULT_AWAKE_GRACE_DELAY_SECS,
  DEFAULT_AWAKE_WHAT,
  DEFAULT_AWAKE_WHEN,
  DEFAULT_RENAME_EXISTING_DAYS,
  DEFAULT_TITLE_EVENT_PROMPT_LINES,
  DEFAULT_WORKTREE_PREFIXES,
  type HookScope,
};

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
  /** Hold the machine awake while a chat is active, or never. */
  awakeWhen: AwakeWhen;
  /** `screen` runs `caffeinate -disu`. `cpu` runs `caffeinate -dis`. */
  awakeWhat: AwakeWhat;
  /** Seconds to keep caffeinate after the last active chat goes idle. 0 stops at once. */
  graceDelaySecs: number;
};

/** Normalises raw configuration values. Unknown values fall back to the defaults. */
export const readTriggerSettings = (get: (key: string) => unknown): TriggerSettings => {
  const patterns = get("activationPatterns");
  const prefixes = get("worktreePrefixes");
  const days = get("renameExistingDays");
  const promptLines = get("titleEventPromptLines");
  const trigger = get("trigger");
  const hookScope = get("hookScope");
  const awakeWhen = get("awake.when");
  const awakeWhat = get("awake.what");
  const graceDelaySecs = get("awake.graceDelaySecs");
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
    awakeWhen: isAwakeWhen(awakeWhen) ? awakeWhen : DEFAULT_AWAKE_WHEN,
    awakeWhat: isAwakeWhat(awakeWhat) ? awakeWhat : DEFAULT_AWAKE_WHAT,
    graceDelaySecs: isAwakeGraceDelaySecs(graceDelaySecs) ? graceDelaySecs : DEFAULT_AWAKE_GRACE_DELAY_SECS,
  };
};
