import { AWAKE_WHENS, type AwakeWhen, HOOK_SCOPES, type HookScope, TRIGGERS, type Trigger } from "./defaults";

/** A worktree prefix entry: a non-empty string without path separators. It holds its own connector (`_v-`). */
export const isWorktreePrefix = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && !/[\\/]/.test(value);

/** A day window: a non-negative integer. 0 means off. */
export const isRenameExistingDays = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/** A line limit: an integer of at least 1. */
export const isPromptLineLimit = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1;

export const isTrigger = (value: unknown): value is Trigger => TRIGGERS.includes(value as Trigger);

export const isHookScope = (value: unknown): value is HookScope => HOOK_SCOPES.includes(value as HookScope);

export const isAwakeWhen = (value: unknown): value is AwakeWhen => AWAKE_WHENS.includes(value as AwakeWhen);

/** A non-empty command. Blank and non-strings are not a command. */
export const isAwakeCmd = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Seconds to hold caffeinate after the last active chat. A non-negative integer. 0 stops at once. */
export const isAwakeGraceDelaySecs = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
