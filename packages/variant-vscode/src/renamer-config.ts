import { type ChatRenamerConfig, readChatRenamerConfig, readPrefix } from "variant-config";

/**
 * The chat renamer's options as variants.yaml defines them: its `chatRenamer` section, over a default of
 * `worktreePrefixes: [variant.prefix]`, so the prefix is defined once. An explicit `chatRenamer.worktreePrefixes`
 * replaces the derived one (an empty list switches the derivation off). The editor's own settings still win over all
 * of this.
 */
export const chatRenamerConfigFor = (workspaceRoot: string | undefined): ChatRenamerConfig =>
  workspaceRoot ? { worktreePrefixes: [readPrefix(workspaceRoot)], ...readChatRenamerConfig(workspaceRoot) } : {};
