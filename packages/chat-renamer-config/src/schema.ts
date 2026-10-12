import { z } from "zod";

import { HOOK_SCOPES, TRIGGERS } from "./defaults";
import { isRenameExistingDays, isWorktreePrefix } from "./rules";

/** `titleEvent` (default) or `hook`. */
export const triggerSchema = z.enum(TRIGGERS);

/** `workspace` (default) or `user`. */
export const hookScopeSchema = z.enum(HOOK_SCOPES);

/** Regular expression sources, in order of precedence. An empty list turns patterns off. */
export const activationPatternsSchema = z.array(z.string());

/** Worktree directory prefixes including their connector. An empty list turns the derivation off. */
export const worktreePrefixesSchema = z.array(
  z.string().refine(isWorktreePrefix, "worktree prefix must be non-empty and must not contain a path separator"),
);

/** Days back to rename existing chats. 0 turns it off. */
export const renameExistingDaysSchema = z
  .number()
  .refine(isRenameExistingDays, "renameExistingDays must be a non-negative integer");

/** The full set of chat renamer options. Every option is optional; an absent one takes its default. */
export const ChatRenamerConfigSchema = z.strictObject({
  trigger: triggerSchema.optional(),
  hookScope: hookScopeSchema.optional(),
  activationPatterns: activationPatternsSchema.optional(),
  worktreePrefixes: worktreePrefixesSchema.optional(),
  renameExistingDays: renameExistingDaysSchema.optional(),
});
export type ChatRenamerConfig = z.infer<typeof ChatRenamerConfigSchema>;
