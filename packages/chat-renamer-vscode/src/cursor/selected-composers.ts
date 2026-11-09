import * as vscode from "vscode";

/** Cursor's ordered selection. Entries are strings or objects that carry `composerId`. */
export const orderedSelectedComposers = <T = unknown>(): Thenable<T> =>
  vscode.commands.executeCommand<T>("composer.getOrderedSelectedComposerIds");
