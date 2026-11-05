import { existsSync } from "node:fs";
import { type ResolvedConfig, type VariantRecord, worktreeReport } from "variant-api";
import { findConfigFile, getVariantsAdoption } from "variant-config";
import { DEFAULT_MAX_DIFF_LINES } from "variant-config/schema";
import { type VariantSort, variantSort } from "variant-ui/state";
import * as vscode from "vscode";
import { createConfigMigration } from "./config-migration.ts";
import { type ActivityLog, createActions, type VariantActions } from "./variants-actions.ts";
import { openInBrowser, readServerToken } from "./variants-browser.ts";
import { type LoadClient, loadVariantClient, messageOf } from "./variants-client.ts";
import { autoExpandEnabled, expandVariantsView } from "./variants-expand.ts";
import { createPanelManager } from "./variants-panel.ts";
import { createVariantsStore, type VariantsStore } from "./variants-store.ts";
import { type VariantNode, VariantsTreeProvider } from "./variants-tree.ts";

export const VIEW_ID = "variant.variants";

const SORT_VALUES = [
  ["nameAsc", "name-asc"],
  ["nameDesc", "name-desc"],
  ["createdAsc", "created-asc"],
  ["createdDesc", "created-desc"],
  ["changedAsc", "changed-asc"],
  ["changedDesc", "changed-desc"],
] as const satisfies ReadonlyArray<readonly [string, VariantSort]>;

const SORT_COMMANDS: Record<string, VariantSort> = Object.fromEntries(
  SORT_VALUES.flatMap(([name, value]) => [
    [`variant.sort.${name}`, value],
    [`variant.sort.${name}Checked`, value],
  ]),
);

const readSort = (): VariantSort => variantSort(vscode.workspace.getConfiguration("variant").get("sort"));

export type { ActivityLog } from "./variants-actions.ts";

export interface ViewDeps {
  /** The first workspace folder: the project the view shows. */
  root: string;
  /** Receives one entry per action and the lines the action reports. Absent in tests that do not read it. */
  log?: ActivityLog;
  loadClient?: LoadClient;
  /** The editor setting `variant.mise.binPath`, read at every load so that a change applies without a reload. */
  miseBinPath?: () => string | undefined;
  hasConfig?: () => boolean;
  kill?: (pid: number, signal: NodeJS.Signals) => void;
  /** The token of the running UI server; read from its file by default. */
  readToken?: () => string | undefined;
  readIndex?: (directory: string) => string;
  /** Rewrites a configuration that uses names of an earlier version and tells the user; see `createConfigMigration`. */
  migrate?: () => void;
  /** Environment for adoption. Tests pass one that counts reads. Absent: the process environment. */
  environment?: () => NodeJS.ProcessEnv;
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
  const loadClient = deps.loadClient ?? loadVariantClient(deps.root, deps.miseBinPath);
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
  /** Slugs whose URL this view already opened after a start. Cleared when play starts that slug again. */
  const opened = new Set<string>();

  const confirmStarted = async (slug: string): Promise<void> => {
    const stop = store.onDidChange(() => {
      const current = store.records().find((entry) => entry.slug === slug);
      const currentPid = current === undefined ? undefined : ownerPid(current);
      if (currentPid !== undefined && !pidAlive(currentPid)) {
        provider.release(slug);
      }
    });
    try {
      while (provider.holding(slug)) {
        const record = store.records().find((entry) => entry.slug === slug);
        const url = record?.url;
        const ready = record === undefined ? undefined : await readyPath(loadClient, record);
        const pid = record === undefined ? undefined : ownerPid(record);
        if (!provider.holding(slug)) {
          return;
        }
        if (url === undefined || ready === undefined || (pid !== undefined && !pidAlive(pid))) {
          provider.release(slug);
          return;
        }
        if (pid === undefined) {
          await sleep(READY_POLL_MS);
          continue;
        }
        let status = 0;
        try {
          status = (await fetch(joinReady(url, ready))).status;
        } catch {
          await sleep(READY_POLL_MS);
          continue;
        }
        if (!provider.holding(slug) || !pidAlive(pid)) {
          provider.release(slug);
          return;
        }
        if (status === 200) {
          provider.release(slug);
          if (!opened.has(slug)) {
            opened.add(slug);
            await vscode.env.openExternal(vscode.Uri.parse(url));
          }
          return;
        }
        await sleep(READY_POLL_MS);
      }
    } finally {
      stop();
    }
  };
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

  const openRow =
    (run: (slug: string) => Promise<void>) =>
    (node?: VariantNode): Promise<void> => {
      const slug = slugOf(node);
      return slug === undefined ? Promise.resolve() : attempt("open url", () => run(slug), { slug });
    };

  context.subscriptions.push(
    vscode.window.createTreeView(VIEW_ID, { treeDataProvider: provider }),
    provider,
    { dispose: () => store.dispose() },
    register("variant.play", (node) => {
      const slug = slugOf(node);
      if (slug === undefined) {
        return Promise.resolve();
      }
      return attempt(
        "watch",
        async () => {
          await store.run(slug, () => actions.watch(slug));
          opened.delete(slug);
          provider.hold(slug);
          // AIDEV-NOTE: the ready GET must not run inside getChildren or before play returns.
          void confirmStarted(slug);
        },
        { slug },
      );
    }),
    register("variant.stop", (node) => {
      const slug = slugOf(node);
      return slug === undefined
        ? Promise.resolve()
        : attempt("stop", () => store.run(slug, () => actions.down(slug)), { slug });
    }),
    register("variant.implode", implode),
    register("variant.implodeDirty", async (node) => {
      const slug = slugOf(node);
      if (slug === undefined) {
        return;
      }
      const worktree = store.records().find((entry) => entry.slug === slug)?.worktree;
      if (worktree !== undefined) {
        const report = await implodeReport(slug, loadClient, store.records());
        if (report.length > 0) {
          log?.info(report);
        }
      }
      const choice = await vscode.window.showWarningMessage(
        "Clean implode failed, do you want to `--force`?",
        "Cancel",
        "Force",
      );
      if (choice !== "Force") {
        log?.info("implode cancelled", { slug });
        return;
      }
      return attempt("implode", () => store.run(slug, () => actions.implode(slug, { force: true })), { slug });
    }),
    register("variant.create", async () => {
      const box = vscode.window.createInputBox();
      box.title = "Create variant";
      box.placeholder = "Slug";
      box.onDidAccept(async () => {
        const slug = box.value.trim();
        if (slug.length === 0) {
          box.validationMessage = "Enter a slug";
          return;
        }
        box.hide();
        await attempt("create", async () => {
          await (await loadClient()).create(slug);
          await store.restart();
        });
      });
      box.onDidHide(() => {
        box.dispose();
      });
      box.show();
    }),
    register("variant.showOutput", (node) => {
      const slug = slugOf(node);
      return slug === undefined ? Promise.resolve() : attempt("show output", () => actions.showOutput(slug), { slug });
    }),
    register(
      "variant.openUrl",
      openRow((slug) => actions.openUrl(slug)),
    ),
    register(
      "variant.openUrlExternal",
      openRow((slug) => actions.openUrl(slug)),
    ),
    register(
      "variant.openUrlCursor",
      openRow((slug) => actions.openUrlInEditor(slug)),
    ),
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
        void vscode.commands.executeCommand("setContext", "variant.currentSort", readSort());
        provider.refresh();
      }
    }),
    { dispose: () => panel.dispose() },
  );

  void vscode.commands.executeCommand("setContext", "variant.currentSort", readSort());
  // The contribution starts collapsed. Expand only for active or detected adoption, then leave the editor focused.
  const adoption = deps.environment ? getVariantsAdoption(deps.root, deps.environment) : getVariantsAdoption(deps.root);
  void expandVariantsView(
    adoption.status !== "none" && autoExpandEnabled(vscode.workspace.getConfiguration("variant").get("autoExpand")),
    (command) => Promise.resolve(vscode.commands.executeCommand(command)),
  );
  try {
    (deps.migrate ?? createConfigMigration({ root: deps.root }).run)();
  } catch (error) {
    log?.error("configuration migration failed", error);
  }
  syncContexts();
  void store.start();
  return { store, actions, loadClient };
};

/** The implode report for `slug`, without removing the worktree. Empty when the row has no worktree. */
const implodeReport = async (
  slug: string,
  loadClient: LoadClient,
  records: readonly VariantRecord[],
): Promise<string> => {
  const worktree = records.find((entry) => entry.slug === slug)?.worktree;
  if (worktree === undefined) {
    return "";
  }
  const client = (await loadClient(worktree)) as { config?: () => ResolvedConfig };
  const maxDiffLines = client.config?.().variant.implode.maxDiffLines ?? DEFAULT_MAX_DIFF_LINES;
  return worktreeReport(worktree, maxDiffLines);
};

/** The pid of the watch whose url is the row url. */
const ownerPid = (record: VariantRecord): number | undefined =>
  Object.values(record.watches ?? {}).find((watch) => watch.url === record.url)?.pid;

/** `ready` of that watch, from the variant's own configuration. Absent when the file names none. */
const readyPath = async (loadClient: LoadClient, record: VariantRecord): Promise<string | undefined> => {
  const key = Object.entries(record.watches ?? {}).find(([, watch]) => watch.url === record.url)?.[0];
  if (key === undefined) {
    return undefined;
  }
  const client = (await loadClient(record.worktree)) as { config?: () => ResolvedConfig };
  return client.config?.().variant.watches[key]?.ready;
};

/** How long a ready GET that is not 200 waits before the next try. Same pace as the library's ready poll. */
const READY_POLL_MS = 1000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** `http://host:port` and `/index.html` become `http://host:port/index.html`, with one slash. */
const joinReady = (url: string, ready: string): string => `${url.endsWith("/") ? url.slice(0, -1) : url}${ready}`;

const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
