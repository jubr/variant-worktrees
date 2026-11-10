import { LEVELS, LIFECYCLE_COMMANDS } from "variant-api/commands";
import { createListener, type SocketListener, socketPath } from "variant-ipc";
import { type LogEvent, type LogLevel, LogOrigin } from "variant-log";
import * as vscode from "vscode";

const logEvent = (args: Record<string, unknown>): LogEvent => {
  const { level, message, step, slug, origin } = args;
  if (typeof level !== "string" || !LEVELS.has(level) || typeof message !== "string") {
    throw new Error("invalid log event");
  }
  const event: LogEvent = { level: level as LogLevel, message };
  if (typeof step === "string") {
    event.step = step;
  }
  if (typeof slug === "string") {
    event.slug = slug;
  }
  if (origin === LogOrigin.cli || origin === LogOrigin.mcp) {
    event.origin = origin;
  }
  return event;
};

const listeners = new Map<string, SocketListener>();

export const stopSockets = async (): Promise<void> => {
  const owned = [...listeners.values()];
  listeners.clear();
  await Promise.all(owned.map((listener) => listener.stop()));
};

/**
 * Specification: openspec/specs/variant-vscode/ipc-endpoint/spec.md
 */
export const bindSockets = async (onLog?: (event: LogEvent) => void): Promise<void> => {
  const folders = vscode.workspace?.workspaceFolders ?? [];
  const paths = new Set(folders.map((folder) => socketPath(folder.uri.fsPath)));
  for (const path of paths) {
    if (listeners.has(path)) {
      continue;
    }
    const listener = createListener(path, (request) => {
      if (request.name === "log") {
        const event = logEvent(request.args);
        onLog?.(event);
        return {};
      }
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
