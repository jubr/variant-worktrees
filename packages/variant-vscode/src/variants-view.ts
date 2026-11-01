import { existsSync } from "node:fs";
import { findConfigFile } from "variant-config";
import * as vscode from "vscode";
import { createActions, type VariantActions } from "./variants-actions.ts";
import { type LoadClient, loadVariantClient, messageOf } from "./variants-client.ts";
import { createVariantsStore, type VariantsStore } from "./variants-store.ts";
import { type VariantNode, VariantsTreeProvider } from "./variants-tree.ts";

export const VIEW_ID = "variant.variants";

export interface ViewDeps {
  /** The first workspace folder: the project the view shows. */
  root: string;
  loadClient?: LoadClient;
  hasConfig?: () => boolean;
  kill?: (pid: number, signal: NodeJS.Signals) => void;
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
  const actions = createActions({
    loadClient,
    records: store.records,
    ...(deps.kill ? { kill: deps.kill } : {}),
  });
  const provider = new VariantsTreeProvider(store);
  const syncContexts = (): void => {
    setContext("variant.noConfig", store.status() === "no-config");
    setContext("variant.noVariants", store.status() === "empty");
  };
  store.onDidChange(syncContexts);

  /** Runs a task; a failure becomes an error notification. */
  const attempt = async (task: () => Promise<void>): Promise<void> => {
    try {
      await task();
    } catch (error) {
      void vscode.window.showErrorMessage(messageOf(error));
    }
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
      return slug === undefined ? Promise.resolve() : attempt(() => store.run(slug, () => actions.watch(slug)));
    }),
    register("variant.stop", (node) => {
      const slug = slugOf(node);
      return slug === undefined ? Promise.resolve() : attempt(() => store.run(slug, () => actions.down(slug)));
    }),
    register("variant.implode", (node) => {
      const slug = slugOf(node);
      if (slug === undefined) {
        return Promise.resolve();
      }
      return attempt(async () => {
        // main is refused by the action itself, before anyone is asked.
        if (slug !== "main" && !(await confirmImplode(slug))) {
          return;
        }
        await store.run(slug, () => actions.implode(slug));
      });
    }),
    register("variant.showOutput", (node) => {
      const slug = slugOf(node);
      return slug === undefined ? Promise.resolve() : attempt(() => actions.showOutput(slug));
    }),
    register("variant.openUrl", (node) => {
      const slug = slugOf(node);
      return slug === undefined ? Promise.resolve() : attempt(() => actions.openUrl(slug));
    }),
    register("variant.stopUiServer", () => attempt(() => actions.stopUiServer())),
  );

  syncContexts();
  void store.start();
  return { store, actions, loadClient };
};
