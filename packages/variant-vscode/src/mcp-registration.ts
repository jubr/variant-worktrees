import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { registerCursorMcp, unregisterCursorMcp } from "./cursor/cursor-mcp-server.ts";

const SERVER_NAME = "variant";

const launch = (
  extensionPath: string,
  folder: string,
): { command: string; args: string[]; env: { ELECTRON_RUN_AS_NODE: string } } => ({
  command: process.execPath,
  args: [join(extensionPath, "dist", "mcp.mjs"), "--cwd", folder],
  env: { ELECTRON_RUN_AS_NODE: "1" },
});

const extensionVersion = (extensionPath: string): string => {
  const manifest = JSON.parse(readFileSync(join(extensionPath, "package.json"), "utf8")) as { version?: string };
  return manifest.version ?? "";
};

/**
 * Specification: openspec/specs/variant-vscode/mcp-registration/spec.md
 */
export const registerExtensionMcp = (context: vscode.ExtensionContext, folder: string): void => {
  if (registerCursorMcp(SERVER_NAME, () => launch(context.extensionPath, folder))) {
    return;
  }
  const registerProvider = vscode.lm?.registerMcpServerDefinitionProvider;
  if (typeof registerProvider !== "function") {
    return;
  }
  const started = launch(context.extensionPath, folder);
  const definition = new vscode.McpStdioServerDefinition(
    SERVER_NAME,
    started.command,
    started.args,
    started.env,
    extensionVersion(context.extensionPath),
  );
  definition.cwd = vscode.Uri.file(folder);
  context.subscriptions.push(
    registerProvider("variant", {
      provideMcpServerDefinitions: () => [definition],
    }),
  );
};

export const unregisterExtensionMcp = (): void => {
  unregisterCursorMcp();
};
