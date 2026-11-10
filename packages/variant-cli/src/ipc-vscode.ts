import { type LogEvent, type LogLevel, LogOrigin, loadConfig, logD, logW, resolveSlug, setLogSink } from "variant-api";
import { connect, type IpcClient, socketPath } from "variant-ipc";
import { showsOnStderr, writeStderrLog } from "./ipc-log.js";

export const explicitSlug = (argv: string[]): string | undefined => {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }
    if (arg === "-s" || arg === "--slug") {
      const value = argv[index + 1];
      return value !== undefined && !value.startsWith("-") ? value : undefined;
    }
    if (arg.startsWith("--slug=")) {
      const value = arg.slice("--slug=".length);
      return value === "" ? undefined : value;
    }
  }
  return undefined;
};

const WRITE_MS = 1000;

let vscodeClient: IpcClient | undefined;
let connecting: Promise<void> | undefined;
let sendChain = Promise.resolve();
let reportedConnect = false;
let socketDropped = false;
let warnedWrite = false;

const limitedWrite = (work: Promise<unknown>): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket write timed out")), WRITE_MS);
    work.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("socket write failed"));
      },
    );
  });

const dropSocket = (): void => {
  if (socketDropped) {
    return;
  }
  socketDropped = true;
  const client = vscodeClient;
  vscodeClient = undefined;
  client?.close();
  if (warnedWrite) {
    return;
  }
  warnedWrite = true;
  logW("write failed", { step: "ipc" });
};

const connectReason = (error: unknown): string => {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
  if (code === "ENOENT") {
    return "file not found";
  }
  if (code === "ECONNREFUSED") {
    return "connection refused";
  }
  if (code === "EACCES" || code === "EPERM") {
    return "permission denied";
  }
  if (error instanceof Error && error.message !== "") {
    return error.message.split("\n")[0] ?? error.message;
  }
  return code === "" ? "unknown" : code;
};

const reportConnect = (ok: boolean, error?: unknown): void => {
  if (reportedConnect) {
    return;
  }
  reportedConnect = true;
  logD(ok ? "connected" : `connect failed: ${connectReason(error)}`, { step: "ipc" });
};

const detectedSlug = (directory: string): string | undefined => {
  try {
    const config = loadConfig({ cwd: directory });
    return resolveSlug(undefined, directory, config.variant.branchPrefixes, config.variant);
  } catch {
    return undefined;
  }
};

/** `ipc` and `cli` are the CLI's own bookkeeping. They stay on stderr and never go to vscode. */
const localOnly = (event: LogEvent): boolean => event.step === "ipc" || event.step === "cli";

const deliver = async (event: LogEvent, directory: string, slug: string | undefined): Promise<void> => {
  if (connecting === undefined) {
    connecting = connect(socketPath(directory)).then(
      (next) => {
        vscodeClient = next;
        reportConnect(true);
      },
      (error: unknown) => {
        vscodeClient = undefined;
        reportConnect(false, error);
      },
    );
  }
  await connecting;
  if (socketDropped || vscodeClient === undefined || localOnly(event)) {
    return;
  }
  const args: Record<string, unknown> = { level: event.level, message: event.message, origin: LogOrigin.cli };
  if (event.step !== undefined) {
    args.step = event.step;
  }
  const eventSlug = event.slug ?? slug;
  if (eventSlug !== undefined) {
    args.slug = eventSlug;
  }
  const pending = vscodeClient.request({ name: "log", args });
  void pending.catch(() => undefined);
  try {
    await limitedWrite(pending);
  } catch (error) {
    if (error instanceof Error && error.message === "socket write timed out") {
      dropSocket();
    }
  }
};

/**
 * Prints events at or above `level` to stderr. Lower events are dropped.
 * `vscode` also sends every event on the project socket, except steps `ipc` and `cli`.
 * Specification: openspec/specs/variant-cli/logging/spec.md
 */
export const attachLogLevel = (level: LogLevel, vscode?: { directory: string; slug?: string }): void => {
  const directory = vscode?.directory;
  const slug = vscode?.slug ?? (directory === undefined ? undefined : detectedSlug(directory));
  vscodeClient = undefined;
  connecting = undefined;
  sendChain = Promise.resolve();
  reportedConnect = false;
  socketDropped = false;
  warnedWrite = false;
  setLogSink((event: LogEvent) => {
    if (showsOnStderr(event, level)) {
      writeStderrLog(event);
    }
    if (directory === undefined) {
      return;
    }
    sendChain = sendChain.then(() => deliver(event, directory, slug)).catch(() => undefined);
  });
};

/** Emits the local CLI-end debug line, waits until queued vscode sends have finished, then closes the socket. */
export const finishCliLog = async (): Promise<void> => {
  logD("end", { step: "cli" });
  let pending = sendChain;
  for (;;) {
    await pending;
    if (pending === sendChain) {
      break;
    }
    pending = sendChain;
  }
  vscodeClient?.close();
  vscodeClient = undefined;
  connecting = undefined;
};
