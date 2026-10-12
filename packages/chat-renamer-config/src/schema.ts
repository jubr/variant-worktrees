import { z } from "zod";

import { HOOK_SCOPES, TRIGGERS } from "./defaults";
import { isWorktreePrefix } from "./rules";

/** `titleEvent` (default) or `hook`. */
export const triggerSchema = z
  .enum(TRIGGERS)
  .describe("What renames a chat: Cursor's title event, or a beforeSubmitPrompt hook.");

/** `workspace` (default) or `user`. */
export const hookScopeSchema = z
  .enum(HOOK_SCOPES)
  .describe("Where the hook is installed when trigger is hook: the first workspace folder or the user home.");

/** Regular expression sources, in order of precedence. An empty list turns patterns off. */
export const activationPatternsSchema = z
  .array(z.string())
  .describe("Regular expressions tested against each prompt line; the first capture group becomes the chat title.");

/** Worktree directory prefixes including their connector. An empty list turns the derivation off. */
export const worktreePrefixesSchema = z
  .array(z.string().refine(isWorktreePrefix, "worktree prefix must be non-empty and must not contain a path separator"))
  .describe("Worktree directory prefixes including their connector, such as _v-, that name a chat when dragged in.");

/** Days back to rename existing chats. 0 turns it off. */
export const renameExistingDaysSchema = z
  .number()
  .int()
  .min(0)
  .describe("Rename existing chats created within this many days. 0 turns it off.");

/** The full set of chat renamer options. Every option is optional; an absent one takes its default. */
export const ChatRenamerConfigSchema = z.strictObject({
  trigger: triggerSchema.optional(),
  hookScope: hookScopeSchema.optional(),
  activationPatterns: activationPatternsSchema.optional(),
  worktreePrefixes: worktreePrefixesSchema.optional(),
  renameExistingDays: renameExistingDaysSchema.optional(),
});
export type ChatRenamerConfig = z.infer<typeof ChatRenamerConfigSchema>;
