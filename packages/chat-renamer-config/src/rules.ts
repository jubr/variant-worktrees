/** A worktree directory prefix: a non-empty string without path separators. */
export const isWorktreePrefix = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && !/[\\/]/.test(value);

/** A day window: a non-negative integer. 0 means off. */
export const isRenameExistingDays = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
