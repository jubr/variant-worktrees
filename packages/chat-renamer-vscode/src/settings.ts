import { readTriggerSettings, type TriggerSettings } from "chat-renamer-api";
import * as vscode from "vscode";

/** Options a host extension supplies, such as the `chatRenamer` section of `variants.yaml`. */
export type HostSettings = Partial<TriggerSettings>;

/**
 * The renamer's effective settings. Per option, a value the user set explicitly in the editor (folder, then workspace,
 * then user settings) wins; then the host-supplied value; then the editor's default, which equals the shared default.
 */
export const readSettings = (section: string, host: HostSettings = {}): TriggerSettings => {
  const config = vscode.workspace.getConfiguration(section);
  return readTriggerSettings((key) => {
    const inspected = config.inspect?.(key);
    const explicit = inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
    if (explicit !== undefined) {
      return explicit;
    }
    const supplied = host[key as keyof TriggerSettings];
    return supplied !== undefined ? supplied : config.get(key);
  });
};
