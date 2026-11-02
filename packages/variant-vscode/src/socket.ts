import { createListener, type SocketListener, socketPath } from "variant-ipc";
import * as vscode from "vscode";

const LIFECYCLE_COMMANDS = new Set(["config", "create", "list", "provision", "up", "down", "watch", "implode"]);

const listeners = new Map<string, SocketListener>();

export const stopSockets = async (): Promise<void> => {
  const owned = [...listeners.values()];
  listeners.clear();
  await Promise.all(owned.map((listener) => listener.stop()));
};

/**
 * Specification: openspec/specs/variant-vscode/ipc-endpoint/spec.md
 */
export const bindSockets = async (): Promise<void> => {
  const folders = vscode.workspace?.workspaceFolders ?? [];
  const paths = new Set(folders.map((folder) => socketPath(folder.uri.fsPath)));
  for (const path of paths) {
    if (listeners.has(path)) {
      continue;
    }
    const listener = createListener(path, (request) => {
      if (LIFECYCLE_COMMANDS.has(request.name)) {
        throw new Error(`${request.name} is not handled on the extension socket`);
      }
      throw new Error(`unsupported editor request: ${request.name}`);
    });
    try {
      await listener.start();
      listeners.set(path, listener);
    } catch {
      await listener.stop();
    }
  }
};
