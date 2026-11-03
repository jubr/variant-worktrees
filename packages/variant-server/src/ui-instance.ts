import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { primaryWorktree } from "variant-api";
import {
  clearRuntime,
  pickFreePort,
  type ResolvedConfig,
  readRuntime,
  resolveMainVscodeDir,
  UI_INSTANCE_KEY,
  UI_PORT_ENV,
  writeRuntime,
} from "variant-config";

export const TOKEN_FILE_NAME = "variant-ui.token";

/** What the server records of itself in the runtime state of `main`: the entry `variant-ui`, without the token. */
export interface UiEntry {
  port?: number;
  pid?: number;
  url?: string;
}

/** The directory of the main checkout, whose `variants.local.yaml` holds the entry. */
export const mainDirectory = (cwd: string): string => {
  try {
    return primaryWorktree(cwd);
  } catch {
    return cwd;
  }
};

/** The owner-only file that keeps the token of the running server, next to the project's editor socket. */
export const tokenPath = (cwd: string): string => join(resolveMainVscodeDir(cwd), TOKEN_FILE_NAME);

export const writeToken = (cwd: string, token: string): void => {
  const path = tokenPath(cwd);
  mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  writeFileSync(path, token, { mode: 0o600 });
  chmodSync(path, 0o600);
};

export const readToken = (cwd: string): string | undefined => {
  const path = tokenPath(cwd);
  return existsSync(path) ? readFileSync(path, "utf8").trim() : undefined;
};

export const removeToken = (cwd: string): void => rmSync(tokenPath(cwd), { force: true });

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** The recorded entry of the UI server of the project. */
export const readEntry = (cwd: string): UiEntry | undefined => {
  try {
    return readRuntime(mainDirectory(cwd), {})?.instances?.[UI_INSTANCE_KEY];
  } catch {
    return undefined;
  }
};

/** The entry of a server that is running; a recorded pid that is gone counts as no server. */
export const runningEntry = (cwd: string): UiEntry | undefined => {
  const entry = readEntry(cwd);
  return entry?.pid !== undefined && isAlive(entry.pid) ? entry : undefined;
};

export const writeEntry = (cwd: string, entry: UiEntry): void => {
  const dir = mainDirectory(cwd);
  const existing = readRuntime(dir, {}) ?? {};
  writeRuntime(dir, { ...existing, instances: { ...existing.instances, [UI_INSTANCE_KEY]: entry } });
};

/** Removes the entry, when it is the one of `pid` (or of any server, without `pid`); other runtime entries stay. */
export const removeEntry = (cwd: string, pid?: number): void => {
  const dir = mainDirectory(cwd);
  const existing = readRuntime(dir, {});
  const entry = existing?.instances?.[UI_INSTANCE_KEY];
  if (!existing || !entry || (pid !== undefined && entry.pid !== pid)) {
    return;
  }
  const { [UI_INSTANCE_KEY]: _removed, ...others } = existing.instances ?? {};
  const { instances: _instances, ...rest } = existing;
  const next = Object.keys(others).length > 0 ? { ...rest, instances: others } : rest;
  if (Object.keys(next).length === 0) {
    clearRuntime(dir);
  } else {
    writeRuntime(dir, next);
  }
};

/**
 * The port of the server: `VARIANT_UI_PORT` when set, else `variant.ui.port`, otherwise a free port of
 * `variant.ports.range`. A port that is named explicitly is kept even when it lies outside the range, as for any watch.
 */
export const chooseUiPort = async (
  config: ResolvedConfig,
  env: NodeJS.ProcessEnv = process.env,
  isFree?: (port: number) => Promise<boolean>,
): Promise<number> => {
  const given = env[UI_PORT_ENV];
  if (given !== undefined && given !== "") {
    const port = Number(given);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`${UI_PORT_ENV} must be a port number, got "${given}"`);
    }
    return port;
  }
  return config.variant.ui?.port ?? pickFreePort(config.variant.ports, { isFree });
};
