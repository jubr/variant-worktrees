import { type ChatRenamerConfig, readChatRenamerConfig, readPrefix } from "variant-config";

/** The variant name prefix of the workspace's variants.yaml, for the chat renamer's dragged-in worktree folders. */
export const worktreePrefixesFor = (workspaceRoot: string | undefined): string[] =>
  workspaceRoot ? [readPrefix(workspaceRoot)] : [];

/** The `chatRenamer` section of the workspace's variants.yaml. The editor's own settings still win over it. */
export const chatRenamerConfigFor = (workspaceRoot: string | undefined): ChatRenamerConfig =>
  workspaceRoot ? readChatRenamerConfig(workspaceRoot) : {};
