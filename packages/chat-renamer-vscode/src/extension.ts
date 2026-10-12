import type * as vscode from "vscode";

import { registerChatRenamer } from "./register";

export const activate = (context: vscode.ExtensionContext): void => {
  registerChatRenamer(context);
};

export const deactivate = (): void => {};
