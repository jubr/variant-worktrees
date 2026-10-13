import { type AgentHostApi, BUILTIN_AGENT_HOST_ID, type ChatRenameDeps, type Description } from "chat-renamer-api";
import * as vscode from "vscode";

/** Identity Cursor's gate expects. Used when the built-in extension is not enumerable. */
const KNOWN_AGENT_HOST: Description = {
  identifier: { value: BUILTIN_AGENT_HOST_ID },
  isBuiltin: true,
  enabledApiProposals: ["cursor", "cursorAgentHost"],
};

/** Resolves live dependencies from the running extension host. */
export const resolveChatRenameDeps = (context: vscode.ExtensionContext): ChatRenameDeps => {
  const donorExtension = vscode.extensions?.getExtension(BUILTIN_AGENT_HOST_ID);
  const donor = (donorExtension?.packageJSON as Description | undefined) ?? KNOWN_AGENT_HOST;
  return {
    cursor: (vscode as unknown as { cursor?: AgentHostApi }).cursor,
    mine: context.extension.packageJSON as Description,
    donor,
  };
};
