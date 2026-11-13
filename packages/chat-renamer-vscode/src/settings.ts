import { readTriggerSettings, type TriggerSettings } from "chat-renamer-api";
import * as vscode from "vscode";

/** `awake` object from `variants.yaml`. Editor keys stay dotted (`awake.when`). */
export type HostAwake = { when?: unknown; cmd?: unknown; graceDelaySecs?: unknown };

/** Options a host extension supplies, such as the `chatRenamer` section of `variants.yaml`. */
export type HostSettings = Partial<TriggerSettings> & { awake?: HostAwake };

/** Trigger settings plus `enable`, which is an editor setting and not a `variants.yaml` field. */
export type RenamerSettings = TriggerSettings & { enabled: boolean };

type Inspected = {
  workspaceFolderValue?: unknown;
  workspaceValue?: unknown;
  globalValue?: unknown;
};

type ConfigReader = {
  get: (key: string) => unknown;
  inspect?: (key: string) => Inspected | undefined;
};

const explicitValue = (config: ConfigReader, key: string): unknown => {
  const inspected = config.inspect?.(key);
  return inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
};

const hostValue = (host: HostSettings, key: string): unknown => {
  if (key === "awake.when") {
    return host.awake?.when;
  }
  if (key === "awake.cmd") {
    return host.awake?.cmd;
  }
  if (key === "awake.graceDelaySecs") {
    return host.awake?.graceDelaySecs;
  }
  return host[key as keyof TriggerSettings];
};

/** `enable` defaults to on. Only a boolean the editor returns counts; anything else stays on. */
const readEnabled = (config: ConfigReader): boolean => {
  const explicit = explicitValue(config, "enable");
  const value = explicit !== undefined ? explicit : config.get("enable");
  return typeof value === "boolean" ? value : true;
};

/**
 * The renamer's effective settings. Per option, a value the user set explicitly in the editor (folder, then workspace,
 * then user settings) wins; then the host-supplied value; then the editor's default, which equals the shared default.
 * `enable` is not taken from the host.
 */
export const readSettings = (section: string, host: HostSettings = {}): RenamerSettings => {
  const config = vscode.workspace.getConfiguration(section);
  return {
    ...readTriggerSettings((key) => {
      const explicit = explicitValue(config, key);
      if (explicit !== undefined) {
        return explicit;
      }
      const supplied = hostValue(host, key);
      return supplied !== undefined ? supplied : config.get(key);
    }),
    enabled: readEnabled(config),
  };
};
