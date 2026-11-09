import { LOG_LEVELS, type LogEvent, LogLevel, loadConfig, logD, logW, resolveSlug, setLogSink } from "variant-api";
import { connect, type IpcClient, socketPath } from "variant-ipc";

/** A global flag, accepted before or after the command name. `warning` selects `warn`. */
export const LOG_LEVEL_FLAG = {
  name: "log-level",
  description: "Minimum log level written to stderr: trace, debug, info, warn, error (warning selects warn)",
} as const;

const NAMES = [...LOG_LEVELS, "warning"] as const;

const RANK: Record<LogLevel, number> = {
  [LogLevel.trace]: 0,
  [LogLevel.debug]: 1,
  [LogLevel.info]: 2,
  [LogLevel.warn]: 3,
  [LogLevel.error]: 4,
};

const ESC = "\u001b";
const RESET = `${ESC}[0m`;
const DARK = `${ESC}[90m`;
const CYAN = `${ESC}[36m`;

const LEVEL_COLOR: Record<LogLevel, string> = {
  [LogLevel.trace]: `${ESC}[38;5;67m`,
  [LogLevel.debug]: `${ESC}[33m`,
  [LogLevel.info]: `${ESC}[32m`,
  [LogLevel.warn]: `${ESC}[38;5;208m`,
  [LogLevel.error]: `${ESC}[31m`,
};

const useColor = (output: { isTTY: boolean; NO_COLOR?: string }): boolean =>
  output.isTTY && output.NO_COLOR === undefined;

const normalize = (value: string | undefined): LogLevel | undefined => {
  if (value === "warning") {
    return LogLevel.warn;
  }
  return (LOG_LEVELS as readonly string[]).includes(value ?? "") ? (value as LogLevel) : undefined;
};

/**
 * Takes `--log-level` out of the arguments, wherever it stands.
 * An unknown value fails before the command runs.
 */
export const takeLogLevel = (argv: string[]): { args: string[]; level: LogLevel } => {
  const args: string[] = [];
  let level: LogLevel = LogLevel.warn;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    const inline = arg.startsWith("--log-level=") ? arg.slice("--log-level=".length) : undefined;
    if (inline === undefined && arg !== "--log-level") {
      args.push(arg);
      continue;
    }
    const value = inline ?? argv[index + 1];
    if (inline === undefined) {
      index += 1;
    }
    const parsed = normalize(value);
    if (parsed === undefined) {
      throw new Error(`--log-level must be one of ${NAMES.join(", ")}.`);
    }
    level = parsed;
  }
  return { args, level };
};

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

/** One stderr line. Color follows a terminal and an unset `NO_COLOR`. The slug is not printed. */
export const formatLogEvent = (event: LogEvent, output: { isTTY: boolean; NO_COLOR?: string }): string => {
  const word = event.level;
  const head = useColor(output) ? `${DARK}[${LEVEL_COLOR[event.level]}${word}${DARK}]${RESET}` : `[${word}]`;
  const step = event.step === undefined ? "" : useColor(output) ? ` ${CYAN}${event.step}${RESET}` : ` ${event.step}`;
  return `${head}${step} ${event.message}\n`;
};

const WRITE_MS = 1000;

let editorClient: IpcClient | undefined;
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
  const client = editorClient;
  editorClient = undefined;
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

const deliver = async (event: LogEvent, directory: string, slug: string | undefined): Promise<void> => {
  if (connecting === undefined) {
    connecting = connect(socketPath(directory)).then(
      (next) => {
        editorClient = next;
        reportConnect(true);
      },
      (error: unknown) => {
        editorClient = undefined;
        reportConnect(false, error);
      },
    );
  }
  await connecting;
  if (socketDropped || editorClient === undefined) {
    return;
  }
  const args: Record<string, unknown> = { level: event.level, message: event.message, origin: "cli" };
  if (event.step !== undefined) {
    args.step = event.step;
  }
  const eventSlug = event.slug ?? slug;
  if (eventSlug !== undefined) {
    args.slug = eventSlug;
  }
  const pending = editorClient.request({ name: "log", args });
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
 * `editor` also sends every event on the project socket.
 * Specification: openspec/specs/variant-cli/logging/spec.md
 */
export const attachLogLevel = (level: LogLevel, editor?: { directory: string; slug?: string }): void => {
  const minimum = RANK[level];
  const directory = editor?.directory;
  const slug = editor?.slug ?? (directory === undefined ? undefined : detectedSlug(directory));
  editorClient = undefined;
  connecting = undefined;
  sendChain = Promise.resolve();
  reportedConnect = false;
  socketDropped = false;
  warnedWrite = false;
  setLogSink((event: LogEvent) => {
    if (RANK[event.level] >= minimum) {
      process.stderr.write(
        formatLogEvent(event, { isTTY: process.stderr.isTTY === true, NO_COLOR: process.env.NO_COLOR }),
      );
    }
    if (directory === undefined) {
      return;
    }
    sendChain = sendChain.then(() => deliver(event, directory, slug)).catch(() => undefined);
  });
};

/** Emits the CLI-end debug event, waits until queued editor sends have finished, then closes the socket. */
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
  editorClient?.close();
  editorClient = undefined;
  connecting = undefined;
};
