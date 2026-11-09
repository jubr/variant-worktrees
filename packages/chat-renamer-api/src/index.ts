/**
 * Editor-independent logic of the Cursor chat renamer: parsing rename requests, numbering titles, reading a chat's
 * first prompt, installing the hook script, and renaming through Cursor's private agent-host API.
 * Nothing here imports `vscode`; chat-renamer wires it into an extension.
 */

export * from "./awake";
export * from "./chat-existing-plan";
export * from "./chat-existing-rename";
export * from "./chat-rename-patterns";
export * from "./chat-rename-settings";
export * from "./chat-rename-slash";
export * from "./chat-renamer-claim";
export * from "./chat-renamer-names";
export * from "./chat-title-numbering";
export * from "./cursor/chat-first-prompt";
export * from "./cursor/chat-rename-hooks";
export * from "./cursor/composer-activity";
export * from "./cursor/cursor-chat-rename";
export * from "./cursor/cursor-dir";
export * from "./log";
