/** How a chat is renamed: from Cursor's title event, or by a `beforeSubmitPrompt` hook. */
export const TRIGGERS = ["titleEvent", "hook"] as const;
export type Trigger = (typeof TRIGGERS)[number];
export const DEFAULT_TRIGGER: Trigger = "titleEvent";

/** Where the hook is installed. */
export const HOOK_SCOPES = ["workspace", "user"] as const;
export type HookScope = (typeof HOOK_SCOPES)[number];
export const DEFAULT_HOOK_SCOPE: HookScope = "workspace";

/** Prompt lines that name a chat. The first capture group is the title. */
export const DEFAULT_ACTIVATION_PATTERNS: readonly string[] = ["/[a-z]+-spec-[a-z]+\\s+([A-Za-z0-9_-]+)"];

/**
 * Prefixes of worktree directories whose dragged-in path names a chat. Each carries its leading character and
 * connector, so `_v-` matches `_v-my-slug`. Empty by default: the host that knows the variant prefix supplies it
 * (variant-vscode passes `variant.prefix`), so that literal lives in variant-config only.
 */
export const DEFAULT_WORKTREE_PREFIXES: readonly string[] = [];

/** How many days back existing chats are renamed. 0 turns it off. */
export const DEFAULT_RENAME_EXISTING_DAYS = 7;
