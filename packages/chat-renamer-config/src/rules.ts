import { HOOK_SCOPES, type HookScope, TRIGGERS, type Trigger } from "./defaults";

/** A worktree prefix entry: a non-empty string without path separators. It holds its own connector (`_v-`). */
export const isWorktreePrefix = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && !/[\\/]/.test(value);

/** A day window: a non-negative integer. 0 means off. */
export const isRenameExistingDays = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

export const isTrigger = (value: unknown): value is Trigger => TRIGGERS.includes(value as Trigger);

export const isHookScope = (value: unknown): value is HookScope => HOOK_SCOPES.includes(value as HookScope);
