import type { VariantRecord } from "variant-api";
import {
  formatUptime,
  sortVariants,
  stateOf,
  UI_WATCH_KEY,
  type VariantSort,
  type VariantState,
} from "variant-ui/state";
import * as vscode from "vscode";
import type { VariantsStore } from "./variants-store.ts";

export type VariantNode =
  | { kind: "variant"; record: VariantRecord }
  | { kind: "ui"; url?: string; pid?: number }
  | { kind: "error"; message: string }
  | { kind: "unreachable"; message: string };

/** The label of the UI server item, and the slug under which the app stops it. */
export const UI_SERVER_LABEL = "UI server";

const SUPERSCRIPT_D = "\u1d48";
const SUPERSCRIPT_2 = "\u00b2";

/** A space and a superscript d. A superscript 2 when `d` cannot be shown. */
export const dbOnlySuffix = (hasGlyph: (char: string) => boolean = () => true): string =>
  ` ${hasGlyph(SUPERSCRIPT_D) ? SUPERSCRIPT_D : SUPERSCRIPT_2}`;

const ICONS: Record<VariantState, string> = {
  watching: "circle-filled",
  up: "arrow-up",
  down: "circle-outline",
};

/** The live UI server entry that `main` records, if there is one. */
export const uiServerOf = (records: readonly VariantRecord[]): { url?: string; pid?: number } | undefined => {
  const watch = records.find((entry) => entry.slug === "main")?.watches?.[UI_WATCH_KEY];
  if (watch === undefined || watch.alive === false) {
    return undefined;
  }
  return {
    ...(watch.url === undefined ? {} : { url: watch.url }),
    ...(watch.pid === undefined ? {} : { pid: watch.pid }),
  };
};

const variantItem = (record: VariantRecord, busy: boolean, confirming: boolean): vscode.TreeItem => {
  const { state, stale } = stateOf(record);
  const label = record.dbOnly ? `${record.slug}${dbOnlySuffix()}` : record.slug;
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
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
    ...(record.dbOnly ? ["Database only: the worktree is gone"] : []),
    `Implode would ${record.implodeClean === false ? "fail" : "succeed"}`,
  ].join("\n");
  if (busy) {
    item.iconPath = new vscode.ThemeIcon("loading~spin");
    item.contextValue = "variant pending";
    return item;
  }
  if (confirming) {
    item.iconPath = new vscode.ThemeIcon("loading~spin");
  } else if (state === "watching") {
    item.iconPath = new vscode.ThemeIcon(ICONS.watching, new vscode.ThemeColor("charts.green"));
  } else {
    item.iconPath = new vscode.ThemeIcon(ICONS[state]);
  }
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
  private readonly confirming = new Set<string>();
  private readonly nodes = new Map<string, { kind: "variant"; record: VariantRecord }>();
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

  /** The row stays on the loading icon until the watch this view started is confirmed up. */
  hold(slug: string): void {
    this.confirming.add(slug);
    this.changed.fire(undefined);
  }

  /** The health check finished or no longer applies. The row uses its state icon again. */
  release(slug: string): void {
    if (this.confirming.delete(slug)) {
      this.changed.fire(undefined);
    }
  }

  /** Whether play is still waiting on this slug's ready check. */
  holding(slug: string): boolean {
    return this.confirming.has(slug);
  }

  getChildren(): VariantNode[] {
    if (this.store.status() === "error") {
      return [{ kind: "error", message: this.store.error() ?? "The variants could not be read" }];
    }
    const records = this.store.records();
    const server = uiServerOf(records);
    const warning = this.store.warning();
    const variants = sortVariants(records, this.sort()).map((record) => this.variantNode(record));
    const slugs = new Set(variants.map((node) => node.record.slug));
    for (const slug of this.nodes.keys()) {
      if (!slugs.has(slug)) {
        this.nodes.delete(slug);
      }
    }
    return [
      ...(warning === undefined ? [] : [{ kind: "unreachable" as const, message: warning }]),
      ...(server ? [{ kind: "ui" as const, ...server }] : []),
      ...variants,
    ];
  }

  /** The same object while `record` is the same value, so a tree can reveal the row it already holds. */
  private variantNode(record: VariantRecord): { kind: "variant"; record: VariantRecord } {
    const current = this.nodes.get(record.slug);
    if (current?.record === record) {
      return current;
    }
    const node = { kind: "variant" as const, record };
    this.nodes.set(record.slug, node);
    return node;
  }

  getTreeItem(node: VariantNode): vscode.TreeItem {
    if (node.kind === "variant") {
      return variantItem(
        node.record,
        this.store.pending().has(node.record.slug),
        this.confirming.has(node.record.slug),
      );
    }
    if (node.kind === "error") {
      const item = new vscode.TreeItem(node.message, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon("error");
      item.tooltip = node.message;
      item.contextValue = "error";
      return item;
    }
    if (node.kind === "unreachable") {
      const item = new vscode.TreeItem("Database unreachable", vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon("warning");
      item.description = node.message;
      item.tooltip = node.message;
      item.contextValue = "database-unreachable";
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
