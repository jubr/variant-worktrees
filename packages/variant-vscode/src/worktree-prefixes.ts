import { readWorktreePrefix } from "variant-config";

/** The worktree prefix of the workspace's variants.yaml, for the chat renamer's dragged-in worktree folders. */
export const worktreePrefixesFor = (workspaceRoot: string | undefined): string[] =>
  workspaceRoot ? [readWorktreePrefix(workspaceRoot)] : [];
