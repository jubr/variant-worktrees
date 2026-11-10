import type { VariantRecord } from "variant-api";
import { UI_WATCH_KEY } from "variant-ui/state";
import * as vscode from "vscode";
import type { LoadClient } from "./variants-client.ts";

/** The extension log an action writes to. */
export interface ActivityLog {
  info(message: string, fields?: Record<string, unknown>): void;
  error(message: string, cause?: unknown, fields?: Record<string, unknown>): void;
  /** Ready-probe lines. Optional so a log that only records actions still type-checks. */
  debug?(message: string, fields?: Record<string, unknown>): void;
}

export interface ActionDeps {
  loadClient: LoadClient;
  /** The current records, to find the log, URL and process of a variant. */
  records: () => readonly VariantRecord[];
  /** Ends a process; `process.kill` by default. */
  kill?: (pid: number, signal: NodeJS.Signals) => void;
  /** Receives the lines an action reports. */
  log?: ActivityLog;
}

/**
 * What a person can do to a variant from the tree or the panel. Each action rejects with the reason it failed.
 *
 * AIDEV-NOTE: these run `variant-api` in-process. They are not reachable from the extension socket (`ipc.ts`), which
 * refuses every lifecycle name.
 */
export interface VariantActions {
  /** A detached watch. */
  watch(slug: string): Promise<void>;
  /** Brings the variant down; for the `variant-ui` row it stops the UI server instead. */
  down(slug: string): Promise<void>;
  /** Removes the variant. The caller has asked for confirmation. `force` discards unmerged work. */
  implode(slug: string, options?: { force?: boolean }): Promise<void>;
  /** Opens the log of the variant's detached watch in an editor. */
  showOutput(slug: string): Promise<void>;
  openUrl(slug: string): Promise<void>;
  /** Opens the row URL in a Simple Browser editor tab. */
  openUrlInEditor(slug: string): Promise<void>;
  stopUiServer(): Promise<void>;
}

export const createActions = (deps: ActionDeps): VariantActions => {
  const report = { log: (line: string) => deps.log?.info(line) };
  const find = (slug: string): VariantRecord | undefined => deps.records().find((entry) => entry.slug === slug);
  /** The item directory: its worktree, which for `main` is the main checkout. Absent in a fixture that never set one. */
  const directoryOf = (slug: string): string | undefined => {
    const worktree = find(slug)?.worktree;
    return worktree ? worktree : undefined;
  };
  const stopUiServer = async (): Promise<void> => {
    const pid = find("main")?.watches?.[UI_WATCH_KEY]?.pid;
    if (pid === undefined) {
      throw new Error("No UI server is running");
    }
    (deps.kill ?? process.kill)(pid, "SIGTERM");
  };
  const requireUrl = (slug: string): string => {
    const url = find(slug)?.url;
    if (url === undefined) {
      throw new Error(`${slug} has no URL`);
    }
    return url;
  };
  return {
    watch: async (slug) => {
      await (await deps.loadClient(directoryOf(slug))).watch(slug, { ...report, detach: true });
    },
    down: async (slug) => {
      if (slug === UI_WATCH_KEY) {
        return stopUiServer();
      }
      await (await deps.loadClient(directoryOf(slug))).down(slug, report);
    },
    implode: async (slug, options) => {
      if (slug === "main") {
        throw new Error("main cannot be imploded");
      }
      await (await deps.loadClient(directoryOf(slug))).implode(slug, {
        ...report,
        ...(options?.force === true ? { force: true } : {}),
      });
    },
    showOutput: async (slug) => {
      const log = find(slug)?.log;
      if (log === undefined) {
        throw new Error(`${slug} has no output yet: start a watch first`);
      }
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(log));
      await vscode.window.showTextDocument(document, { preview: true });
    },
    openUrl: async (slug) => {
      await vscode.env.openExternal(vscode.Uri.parse(requireUrl(slug)));
    },
    openUrlInEditor: async (slug) => {
      await vscode.commands.executeCommand("simpleBrowser.api.open", vscode.Uri.parse(requireUrl(slug)));
    },
    stopUiServer,
  };
};
