import { existsSync } from "node:fs";
import { findConfigFile } from "variant-config";
import { type VariantSort, variantSort } from "variant-ui/state";
import * as vscode from "vscode";
import { type ActivityLog, createActions, type VariantActions } from "./variants-actions.ts";
import { openInBrowser, readServerToken } from "./variants-browser.ts";
import { type LoadClient, loadVariantClient, messageOf } from "./variants-client.ts";
import { autoExpandEnabled, expandVariantsView } from "./variants-expand.ts";
import { createPanelManager } from "./variants-panel.ts";
import { createVariantsStore, type VariantsStore } from "./variants-store.ts";
import { type VariantNode, VariantsTreeProvider } from "./variants-tree.ts";

export const VIEW_ID = "variant.variants";

const SORT_COMMANDS: Record<string, VariantSort> = {
  "variant.sort.nameAsc": "name-asc",
  "variant.sort.nameDesc": "name-desc",
  "variant.sort.createdAsc": "created-asc",
  "variant.sort.createdDesc": "created-desc",
  "variant.sort.changedAsc": "changed-asc",
  "variant.sort.changedDesc": "changed-desc",
};

const readSort = (): VariantSort => variantSort(vscode.workspace.getConfiguration("variant").get("sort"));

export type { ActivityLog } from "./variants-actions.ts";

export interface ViewDeps {
  /** The first workspace folder: the project the view shows. */
  root: string;
  /** Receives one entry per action and the lines the action reports. Absent in tests that do not read it. */
  log?: ActivityLog;
  loadClient?: LoadClient;
  hasConfig?: () => boolean;
  kill?: (pid: number, signal: NodeJS.Signals) => void;
  /** The token of the running UI server; read from its file by default. */
  readToken?: () => string | undefined;
  readIndex?: (directory: string) => string;
}

export interface VariantsView {
  store: VariantsStore;
  actions: VariantActions;
  loadClient: LoadClient;
}

const setContext = (key: string, value: boolean): void => {
  void vscode.commands.executeCommand("setContext", key, value);
};

const slugOf = (node: VariantNode | undefined): string | undefined =>
  node?.kind === "variant" ? node.record.slug : undefined;

/**
 * The Variants view of the Explorer: the tree, its welcome contexts, and the commands of its items.
 *
 * Specification: openspec/changes/vscode-view/specs/variant-vscode/variants-tree/spec.md
 */
export const registerVariantsView = (context: vscode.ExtensionContext, deps: ViewDeps): VariantsView => {
  const loadClient = deps.loadClient ?? loadVariantClient(deps.root);
  const store = createVariantsStore({
    loadClient,
    hasConfig: deps.hasConfig ?? (() => findConfigFile(deps.root) !== undefined && existsSync(deps.root)),
  });
  const log = deps.log;
  const actions = createActions({
    loadClient,
    records: store.records,
    ...(deps.kill ? { kill: deps.kill } : {}),
    ...(log ? { log } : {}),
  });
  const panel = createPanelManager({
    extensionUri: context.extensionUri,
    loadClient,
    actions,
    store,
    ...(log ? { log } : {}),
    ...(deps.readIndex ? { readIndex: deps.readIndex } : {}),
  });
  const provider = new VariantsTreeProvider(store, readSort);
  const syncContexts = (): void => {
    setContext("variant.noConfig", store.status() === "no-config");
    setContext("variant.noVariants", store.status() === "empty");
  };
  store.onDidChange(syncContexts);

  /**
   * Records an action, then runs it. A failure is recorded with its message and rethrown.
   * Cancelling before this is called leaves no finished entry.
   */
  const record = async (name: string, task: () => Promise<void>, fields?: Record<string, unknown>): Promise<void> => {
    log?.info(name, fields);
    try {
      await task();
      log?.info(`${name} finished`, fields);
    } catch (error) {
      log?.error(`${name} failed`, error, fields);
      throw error;
    }
  };

  /** Runs a task; a failure becomes an error notification and a log entry. */
  const attempt = async (name: string, task: () => Promise<void>, fields?: Record<string, unknown>): Promise<void> => {
    try {
      await record(name, task, fields);
    } catch (error) {
      void vscode.window.showErrorMessage(messageOf(error));
    }
  };

  const implode = async (node?: VariantNode): Promise<void> => {
    const slug = slugOf(node);
    if (slug === undefined) {
      return;
    }
    if (slug !== "main" && !(await confirmImplode(slug))) {
      log?.info("implode cancelled", { slug });
      return;
    }
    return attempt("implode", () => store.run(slug, () => actions.implode(slug)), { slug });
  };

  const confirmImplode = async (slug: string): Promise<boolean> => {
    const choice = await vscode.window.showWarningMessage(
      `Implode ${slug}?`,
      { modal: true, detail: `This removes the database target and the worktree of ${slug}. It cannot be undone.` },
      "Implode",
    );
    return choice === "Implode";
  };

  const register = (id: string, callback: (node?: VariantNode) => Promise<void>): vscode.Disposable =>
    vscode.commands.registerCommand(id, callback);

  context.subscriptions.push(
    vscode.window.createTreeView(VIEW_ID, { treeDataProvider: provider }),
    provider,
    { dispose: () => store.dispose() },
    register("variant.play", (node) => {
      const slug = slugOf(node);
      return slug === undefined
        ? Promise.resolve()
        : attempt("watch", () => store.run(slug, () => actions.watch(slug)), { slug });
    }),
    register("variant.stop", (node) => {
      const slug = slugOf(node);
      return slug === undefined
        ? Promise.resolve()
        : attempt("stop", () => store.run(slug, () => actions.down(slug)), { slug });
    }),
    register("variant.implode", implode),
    register("variant.implodeDirty", implode),
    register("variant.showOutput", (node) => {
      const slug = slugOf(node);
      return slug === undefined ? Promise.resolve() : attempt("show output", () => actions.showOutput(slug), { slug });
    }),
    register("variant.openUrl", (node) => {
      const slug = slugOf(node);
      return slug === undefined ? Promise.resolve() : attempt("open url", () => actions.openUrl(slug), { slug });
    }),
    register("variant.stopUiServer", () => attempt("stop ui server", () => actions.stopUiServer())),
    register("variant.openPanel", () => attempt("open panel", () => panel.open())),
    register("variant.openInBrowser", () =>
      attempt("open in browser", () =>
        openInBrowser({ records: store.records, readToken: deps.readToken ?? (() => readServerToken(deps.root)) }),
      ),
    ),
    ...Object.entries(SORT_COMMANDS).map(([id, value]) =>
      register(id, async () => {
        await vscode.workspace.getConfiguration("variant").update("sort", value, vscode.ConfigurationTarget.Global);
      }),
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("variant.sort")) {
        provider.refresh();
      }
    }),
    { dispose: () => panel.dispose() },
  );

  // The host remembers a collapsed section. Expand it unless the setting opts out, then leave the editor focused.
  void expandVariantsView(
    autoExpandEnabled(vscode.workspace.getConfiguration("variant").get("autoExpand")),
    (command) => Promise.resolve(vscode.commands.executeCommand(command)),
  );
  syncContexts();
  void store.start();
  return { store, actions, loadClient };
};
