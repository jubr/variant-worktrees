/**
 * Editor-independent logic of the Cursor chat renamer: parsing rename requests, numbering titles, reading a chat's
 * first prompt, installing the hook script, and renaming through Cursor's private agent-host API.
 * Nothing here imports `vscode`; chat-renamer-vscode wires it into an extension.
 */

export * from "./chat-existing-plan";
export * from "./chat-first-prompt";
export * from "./chat-rename-hooks";
export * from "./chat-rename-patterns";
export * from "./chat-rename-settings";
export * from "./chat-rename-slash";
export * from "./chat-renamer-claim";
export * from "./chat-renamer-names";
export * from "./chat-title-numbering";
export * from "./cursor-chat-rename";
export * from "./log";
