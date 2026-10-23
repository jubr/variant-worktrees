/** How a chat is renamed: from Cursor's title event, or by a `beforeSubmitPrompt` hook. */
export const TRIGGERS = ["titleEvent", "hook"] as const;
export type Trigger = (typeof TRIGGERS)[number];
export const DEFAULT_TRIGGER: Trigger = "titleEvent";

/** Where the hook is installed. */
export const HOOK_SCOPES = ["workspace", "user"] as const;
export type HookScope = (typeof HOOK_SCOPES)[number];
export const DEFAULT_HOOK_SCOPE: HookScope = "workspace";

/** Prompt lines that name a chat. The first capture group is the title. */
export const DEFAULT_PATH_ACTIVATION_PATTERN = "/[a-z]+-spec-[a-z]+\\s+@\\S+/[A-Za-z0-9_]+-([A-Za-z0-9_-]+)/?(?=\\s|$)";

/** `/<word>-spec-<word> @_work-slug` with no path. The capture group is the slug after `_work-`. */
export const DEFAULT_SHORT_ACTIVATION_PATTERN = "/[a-z]+-spec-[a-z]+\\s+@_work-([A-Za-z0-9_-]+)/?(?=\\s|$)";

/** The path pattern is first so `@<path>` wins over the short and slug patterns on the same line. */
export const DEFAULT_ACTIVATION_PATTERNS: readonly string[] = [
  DEFAULT_PATH_ACTIVATION_PATTERN,
  DEFAULT_SHORT_ACTIVATION_PATTERN,
  "/[a-z]+-spec-[a-z]+\\s+([A-Za-z0-9_-]+)",
];

/**
 * Prefixes of worktree directories whose dragged-in path names a chat. Each carries its leading character and
 * connector, so `_v-` matches `_v-my-slug`. Empty by default: the host that knows the variant prefix supplies it
 * (variant-vscode passes `variant.prefix`), so that literal lives in variant-config only.
 */
export const DEFAULT_WORKTREE_PREFIXES: readonly string[] = [];

/** How many days back existing chats are renamed. 0 turns it off. */
export const DEFAULT_RENAME_EXISTING_DAYS = 7;

/** How many lines of a chat's first prompt the title event reads. A rename request is expected near the top. */
export const DEFAULT_TITLE_EVENT_PROMPT_LINES = 10;
