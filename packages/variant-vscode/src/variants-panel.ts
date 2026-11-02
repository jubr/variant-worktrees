import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ActionRequest, attachWebviewHost } from "variant-ui/protocol";
import * as vscode from "vscode";
import type { ActivityLog, VariantActions } from "./variants-actions.ts";
import { type LoadClient, messageOf, recordSource } from "./variants-client.ts";
import type { VariantsStore } from "./variants-store.ts";

export const PANEL_TYPE = "variant.panel";

/** Where the build of the variants app sits in the extension, next to the bundle. */
const WEBVIEW_DIRECTORY = ["dist", "webview"];

/**
 * The page of the webview: the built `index.html` of the app, with its files rewritten to the extension's own and a
 * content security policy that runs only the script that carries `nonce`.
 *
 * AIDEV-NOTE: `font-src data:` is there because the codicon font is inlined into the stylesheet. Nothing may connect
 * out of the page: the app talks to the extension through `postMessage` only.
 */
export const buildPanelHtml = (options: {
  indexHtml: string;
  nonce: string;
  cspSource: string;
  toUri: (file: string) => string;
}): string => {
  const policy = [
    "default-src 'none'",
    `script-src 'nonce-${options.nonce}'`,
    `style-src ${options.cspSource}`,
    `font-src data: ${options.cspSource}`,
    `img-src data: ${options.cspSource}`,
  ].join("; ");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`;
  return options.indexHtml
    .replace(
      /(\s(?:src|href)=")\.\/([^"]+)"/g,
      (_match, attribute: string, file: string) => `${attribute}${options.toUri(file)}"`,
    )
    .replace(/<script\b/g, `<script nonce="${options.nonce}"`)
    .replace(/<head>/, `<head>\n    ${meta}`);
};

export interface PanelDeps {
  extensionUri: vscode.Uri;
  loadClient: LoadClient;
  actions: VariantActions;
  /** Marks a slug as busy in the Variants view while a panel action on it runs. */
  store: VariantsStore;
  /** Receives one entry per panel action. */
  log?: ActivityLog;
  nonce?: () => string;
  readIndex?: (directory: string) => string;
}

export interface PanelManager {
  /** Opens the panel, or reveals it when it is open. */
  open(): Promise<void>;
  dispose(): void;
}

/**
 * The editor panel with the variants app. It runs the same actions as the Variants view and answers the page's
 * requests over the message transport of `variant-ui`.
 *
 * Specification: openspec/changes/vscode-view/specs/variant-vscode/variants-panel/spec.md
 */
export const createPanelManager = (deps: PanelDeps): PanelManager => {
  let current: vscode.WebviewPanel | undefined;
  const source = recordSource(deps.loadClient);

  const perform = (request: ActionRequest): Promise<void> => {
    const { actions, store } = deps;
    const { slug } = request;
    switch (request.action) {
      case "watch":
        return store.run(slug, () => actions.watch(slug));
      case "down":
        return store.run(slug, () => actions.down(slug));
      case "implode":
        if (request.confirm !== true) {
          return Promise.reject(new Error("implode needs a confirmation"));
        }
        return store.run(slug, () => actions.implode(slug));
      case "showOutput":
        return actions.showOutput(slug);
    }
  };

  const run = async (request: ActionRequest): Promise<void> => {
    const fields = { slug: request.slug };
    deps.log?.info(request.action, fields);
    try {
      await perform(request);
      deps.log?.info(`${request.action} finished`, fields);
    } catch (error) {
      deps.log?.error(`${request.action} failed`, error, fields);
      throw error;
    }
  };

  const open = async (): Promise<void> => {
    if (current !== undefined) {
      current.reveal();
      return;
    }
    const directory = vscode.Uri.joinPath(deps.extensionUri, ...WEBVIEW_DIRECTORY);
    let indexHtml: string;
    try {
      indexHtml = (deps.readIndex ?? ((dir) => readFileSync(join(dir, "index.html"), "utf8")))(directory.fsPath);
    } catch (error) {
      void vscode.window.showErrorMessage(`The variants app is not part of this installation: ${messageOf(error)}`);
      return;
    }
    const panel = vscode.window.createWebviewPanel(PANEL_TYPE, "Variant Worktrees", vscode.ViewColumn.Active, {
      enableScripts: true,
      localResourceRoots: [directory],
    });
    current = panel;
    panel.webview.html = buildPanelHtml({
      indexHtml,
      nonce: (deps.nonce ?? (() => randomBytes(16).toString("base64url")))(),
      cspSource: panel.webview.cspSource,
      toUri: (file) => panel.webview.asWebviewUri(vscode.Uri.joinPath(directory, file)).toString(),
    });
    const host = attachWebviewHost(
      {
        post: (message) => void panel.webview.postMessage(message),
        listen: (handler) => {
          const subscription = panel.webview.onDidReceiveMessage(handler);
          return () => subscription.dispose();
        },
      },
      source,
      run,
    );
    panel.onDidDispose(() => {
      host.dispose();
      current = undefined;
    });
  };

  return {
    open,
    dispose: () => current?.dispose(),
  };
};
