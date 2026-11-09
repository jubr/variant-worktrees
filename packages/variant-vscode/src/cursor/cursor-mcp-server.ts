import * as vscode from "vscode";

export type CursorStdioServer = {
  command: string;
  args: string[];
  env: Record<string, string>;
};

let registeredName: string | undefined;

/** Registers with Cursor's private MCP API. Returns false when this host has no such API. */
export const registerCursorMcp = (name: string, server: () => CursorStdioServer): boolean => {
  const registerServer = vscode.cursor?.mcp?.registerServer;
  if (typeof registerServer !== "function") {
    return false;
  }
  registerServer({ name, server: server() });
  registeredName = name;
  return true;
};

/** Drops the server registered with Cursor. A host that never registered is left alone. */
export const unregisterCursorMcp = (): void => {
  const name = registeredName;
  if (name === undefined) {
    return;
  }
  registeredName = undefined;
  const unregisterServer = vscode.cursor?.mcp?.unregisterServer;
  if (typeof unregisterServer === "function") {
    unregisterServer(name);
  }
};
