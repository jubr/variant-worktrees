import type { VariantRecord } from "variant-api";
import {
  formatUptime,
  sortVariants,
  stateOf,
  UI_INSTANCE_KEY,
  type VariantSort,
  type VariantState,
} from "variant-ui/state";
import * as vscode from "vscode";
import type { VariantsStore } from "./variants-store.ts";

export type VariantNode =
  | { kind: "variant"; record: VariantRecord }
  | { kind: "ui"; url?: string; pid?: number }
  | { kind: "error"; message: string };

/** The label of the UI server item, and the slug under which the app stops it. */
export const UI_SERVER_LABEL = "UI server";

const ICONS: Record<VariantState, string> = {
  watching: "eye",
  up: "vm-running",
  down: "circle-outline",
};

/** The live UI server entry that `main` records, if there is one. */
export const uiServerOf = (records: readonly VariantRecord[]): { url?: string; pid?: number } | undefined => {
  const instance = records.find((entry) => entry.slug === "main")?.instances?.[UI_INSTANCE_KEY];
  if (instance === undefined || instance.alive === false) {
    return undefined;
  }
  return {
    ...(instance.url === undefined ? {} : { url: instance.url }),
    ...(instance.pid === undefined ? {} : { pid: instance.pid }),
  };
};

const variantItem = (record: VariantRecord, busy: boolean): vscode.TreeItem => {
  const { state, stale } = stateOf(record);
  const item = new vscode.TreeItem(record.slug, vscode.TreeItemCollapsibleState.None);
  item.id = `variant:${record.slug}`;
  if (record.uptimeSeconds !== undefined) {
    item.description = formatUptime(record.uptimeSeconds);
  }
  item.tooltip = [
    record.slug,
    `State: ${state}${stale ? " (stale record: its processes are gone)" : ""}`,
    `Mode: ${record.mode ?? "none"}`,
    `URL: ${record.url ?? "none"}`,
    `Worktree: ${record.worktree ?? "none"}`,
  ].join("\n");
  if (busy) {
    item.iconPath = new vscode.ThemeIcon("loading~spin");
    item.contextValue = "variant pending";
    return item;
  }
  item.iconPath = new vscode.ThemeIcon(ICONS[state]);
  item.contextValue = [
    "variant",
    state,
    record.slug === "main" ? "main" : "removable",
    record.implodeClean === false ? "dirty" : "clean",
    ...(record.log === undefined ? [] : ["has-log"]),
    ...(record.url === undefined ? [] : ["has-url"]),
  ].join(" ");
  return item;
};

/** The Variants view: the UI server above the variants, then the variants in `variant.sort` order. */
export class VariantsTreeProvider implements vscode.TreeDataProvider<VariantNode> {
  private readonly changed = new vscode.EventEmitter<VariantNode | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private readonly stopListening: () => void;

  constructor(
    private readonly store: VariantsStore,
    private readonly sort: () => VariantSort = () => "name-asc",
  ) {
    this.stopListening = store.onDidChange(() => this.changed.fire(undefined));
  }

  /** Asks the view to read the records again, for example after `variant.sort` changes. */
  refresh(): void {
    this.changed.fire(undefined);
  }

  getChildren(): VariantNode[] {
    if (this.store.status() === "error") {
      return [{ kind: "error", message: this.store.error() ?? "The variants could not be read" }];
    }
    const records = this.store.records();
    const server = uiServerOf(records);
    return [
      ...(server ? [{ kind: "ui" as const, ...server }] : []),
      ...sortVariants(records, this.sort()).map((record) => ({ kind: "variant" as const, record })),
    ];
  }

  getTreeItem(node: VariantNode): vscode.TreeItem {
    if (node.kind === "variant") {
      return variantItem(node.record, this.store.pending().has(node.record.slug));
    }
    if (node.kind === "error") {
      const item = new vscode.TreeItem(node.message, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon("error");
      item.tooltip = node.message;
      item.contextValue = "error";
      return item;
    }
    const item = new vscode.TreeItem(UI_SERVER_LABEL, vscode.TreeItemCollapsibleState.None);
    item.id = "ui-server";
    item.iconPath = new vscode.ThemeIcon("globe");
    if (node.url !== undefined) {
      item.description = node.url;
    }
    item.tooltip = `The variants web page is served at ${node.url ?? "an unknown address"}`;
    item.contextValue = "ui-server";
    return item;
  }

  dispose(): void {
    this.stopListening();
    this.changed.dispose();
  }
}
