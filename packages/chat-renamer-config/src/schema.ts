import { z } from "zod";

/** A worktree directory prefix: non-empty, no path separator. */
export const worktreePrefixSchema = z
  .string()
  .min(1)
  .refine((value) => !/[\\/]/.test(value), "worktreePrefix must not contain a path separator");

/** Regular expression sources, in order of precedence. An empty list turns patterns off. */
export const activationPatternsSchema = z.array(z.string());

/** Days back to rename existing chats. 0 turns it off. */
export const renameExistingDaysSchema = z.number().int().min(0);
