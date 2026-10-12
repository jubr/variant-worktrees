import { type AgentHostApi, BUILTIN_AGENT_HOST_ID, type ChatRenameDeps, type Description } from "chat-renamer-api";
import * as vscode from "vscode";

/** Resolves live dependencies from the running extension host. Throws when Cursor internals are missing. */
export const resolveChatRenameDeps = (context: vscode.ExtensionContext): ChatRenameDeps => {
  const donorExtension = vscode.extensions?.getExtension(BUILTIN_AGENT_HOST_ID);
  const donor = donorExtension?.packageJSON as Description | undefined;
  if (!donor) {
    throw new Error(`${BUILTIN_AGENT_HOST_ID} is not installed in this editor`);
  }
  return {
    cursor: (vscode as unknown as { cursor?: AgentHostApi }).cursor,
    mine: context.extension.packageJSON as Description,
    donor,
  };
};
