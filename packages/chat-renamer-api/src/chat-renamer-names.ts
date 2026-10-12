/** Identifiers that differ per host extension, so two extensions embedding the renamer do not collide. */
export type ChatRenamerNames = {
  /** Command id for renaming a chat by id and title. */
  renameChat: string;
  /** Command id for renaming a chat from prompt text. */
  renameChatFromPrompt: string;
  /** Configuration section holding `trigger`, `hookScope` and `activationPatterns`. */
  configSection: string;
  /** File name of the hook script written to `.cursor/hooks/`. */
  hookScriptName: string;
};

export type ChatRenamerNamesInput = {
  /** Prefix of the command ids and the hook script name. Default `chat-renamer`. */
  commandPrefix?: string;
  /** Configuration section. Default: the command prefix. */
  configSection?: string;
};

export const chatRenamerNames = ({
  commandPrefix = "chat-renamer",
  configSection = commandPrefix,
}: ChatRenamerNamesInput = {}): ChatRenamerNames => ({
  renameChat: `${commandPrefix}.renameChat`,
  renameChatFromPrompt: `${commandPrefix}.renameChatFromPrompt`,
  configSection,
  hookScriptName: `${commandPrefix}-chat-rename.sh`,
});
