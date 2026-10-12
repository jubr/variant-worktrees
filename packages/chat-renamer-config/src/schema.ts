import { z } from "zod";

import { isRenameExistingDays, isWorktreePrefix } from "./rules";

/** A worktree directory prefix: non-empty, no path separator. */
export const worktreePrefixSchema = z
  .string()
  .min(1)
  .refine(isWorktreePrefix, "worktreePrefix must not contain a path separator");

/** Regular expression sources, in order of precedence. An empty list turns patterns off. */
export const activationPatternsSchema = z.array(z.string());

/** Days back to rename existing chats. 0 turns it off. */
export const renameExistingDaysSchema = z
  .number()
  .refine(isRenameExistingDays, "renameExistingDays must be a non-negative integer");
