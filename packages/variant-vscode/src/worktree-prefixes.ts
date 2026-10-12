import { readPrefix } from "variant-config";

/** The variant name prefix of the workspace's variants.yaml, for the chat renamer's dragged-in worktree folders. */
export const worktreePrefixesFor = (workspaceRoot: string | undefined): string[] =>
  workspaceRoot ? [readPrefix(workspaceRoot)] : [];
