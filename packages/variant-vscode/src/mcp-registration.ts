import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";

const SERVER_NAME = "variant";

let registeredWithCursor = false;

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
  const registerServer = vscode.cursor?.mcp?.registerServer;
  if (typeof registerServer === "function") {
    registerServer({ name: SERVER_NAME, server: launch(context.extensionPath, folder) });
    registeredWithCursor = true;
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
  if (!registeredWithCursor) {
    return;
  }
  registeredWithCursor = false;
  const unregisterServer = vscode.cursor?.mcp?.unregisterServer;
  if (typeof unregisterServer === "function") {
    unregisterServer(SERVER_NAME);
  }
};
