/** Prefix of worktree directories: `<prefix>-<slug>`. */
export const DEFAULT_WORKTREE_PREFIX = "_v";

/** Prompt lines that name a chat. The first capture group is the title. */
export const DEFAULT_ACTIVATION_PATTERNS: readonly string[] = ["/[a-z]+-spec-[a-z]+\\s+([A-Za-z0-9_-]+)"];

/** How many days back existing chats are renamed. 0 turns it off. */
export const DEFAULT_RENAME_EXISTING_DAYS = 7;
