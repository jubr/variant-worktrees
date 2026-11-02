import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { VariantRecord } from "variant-api";
import { resolveMainVscodeDir } from "variant-config";
import * as vscode from "vscode";
import { uiServerOf } from "./variants-tree.ts";

/** The command that starts the UI server in the background. */
export const START_COMMAND = "variant ui --detach";

/** The name of the file, next to the project's editor socket, that holds the token of the running server. */
const TOKEN_FILE = "variant-ui.token";

/** The token of the running UI server of the project, or `undefined` when there is none. */
export const readServerToken = (root: string): string | undefined => {
  try {
    return readFileSync(join(resolveMainVscodeDir(root), TOKEN_FILE), "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
};

export interface BrowserDeps {
  records: () => readonly VariantRecord[];
  readToken: () => string | undefined;
}

/**
 * Opens the web page of the running UI server in the external browser. Starts no server: without one it says how to.
 *
 * Specification: openspec/changes/vscode-view/specs/variant-vscode/variants-panel/spec.md
 */
export const openInBrowser = async (deps: BrowserDeps): Promise<void> => {
  const url = uiServerOf(deps.records())?.url;
  const token = deps.readToken();
  if (url === undefined || token === undefined) {
    const copy = "Copy command";
    const choice = await vscode.window.showInformationMessage(
      `No UI server is running. Start one with \`${START_COMMAND}\`.`,
      copy,
    );
    if (choice === copy) {
      await vscode.env.clipboard.writeText(START_COMMAND);
    }
    return;
  }
  await vscode.env.openExternal(vscode.Uri.parse(`${url}/?token=${token}`));
};
