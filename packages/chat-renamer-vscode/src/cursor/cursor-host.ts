import { type AgentHostApi, BUILTIN_AGENT_HOST_ID, type ChatRenameDeps, type Description } from "chat-renamer-api";
import * as vscode from "vscode";

/** The private proposals Cursor's gate expects on the built-in agent-host extension. */
const AGENT_HOST_PROPOSALS = [
  "control",
  "cursor",
  "cursorNoDeps",
  "cursorAgentHost",
  "cursorTracing",
  "cursorPseudoterminal",
];

/**
 * Cursor 3.24 runs the agent host in its own extension host, so the regular host no longer lists it. The gate on the
 * rename API only compares `isBuiltin`, the identifier's lower-cased key and the proposal list, so a stand-in works.
 *
 * AIDEV-NOTE: keep `_lower` on the identifier. Cursor compares extension identifiers through that field.
 */
const standInAgentHostDescription = (): Description & { identifier: { value: string; _lower: string } } => ({
  identifier: { value: BUILTIN_AGENT_HOST_ID, _lower: BUILTIN_AGENT_HOST_ID.toLowerCase() },
  isBuiltin: true,
  enabledApiProposals: [...AGENT_HOST_PROPOSALS],
});

/** Resolves live dependencies from the running extension host. Prefers the real built-in's description. */
export const resolveChatRenameDeps = (context: vscode.ExtensionContext): ChatRenameDeps => {
  const listed = vscode.extensions?.getExtension(BUILTIN_AGENT_HOST_ID)?.packageJSON as Description | undefined;
  return {
    cursor: (vscode as unknown as { cursor?: AgentHostApi }).cursor,
    mine: context.extension.packageJSON as Description,
    donor: listed ?? standInAgentHostDescription(),
  };
};
