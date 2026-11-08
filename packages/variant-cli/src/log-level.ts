import { LOG_LEVELS, type LogEvent, type LogLevel, logD, setLogSink } from "variant-api";
import { connect, type IpcClient, socketPath } from "variant-ipc";

/** A global flag, accepted before or after the command name. `warning` selects `warn`. */
export const LOG_LEVEL_FLAG = {
  name: "log-level",
  description: "Minimum log level written to stderr: trace, debug, info, warn, error (warning selects warn)",
} as const;

const NAMES = [...LOG_LEVELS, "warning"] as const;

const RANK: Record<LogLevel, number> = { trace: 0, debug: 1, info: 2, warn: 3, error: 4 };

const ESC = "\u001b";
const RESET = `${ESC}[0m`;
const DARK = `${ESC}[90m`;
const CYAN = `${ESC}[36m`;

const LEVEL_COLOR: Record<LogLevel, string> = {
  trace: `${ESC}[38;5;67m`,
  debug: `${ESC}[33m`,
  info: `${ESC}[32m`,
  warn: `${ESC}[38;5;208m`,
  error: `${ESC}[31m`,
};

const useColor = (output: { isTTY: boolean; NO_COLOR?: string }): boolean =>
  output.isTTY && output.NO_COLOR === undefined;

const normalize = (value: string | undefined): LogLevel | undefined => {
  if (value === "warning") {
    return "warn";
  }
  return (LOG_LEVELS as readonly string[]).includes(value ?? "") ? (value as LogLevel) : undefined;
};

/**
 * Takes `--log-level` out of the arguments, wherever it stands.
 * An unknown value fails before the command runs.
 */
export const takeLogLevel = (argv: string[]): { args: string[]; level: LogLevel } => {
  const args: string[] = [];
  let level: LogLevel = "warn";
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

/** One stderr line. Color follows a terminal and an unset `NO_COLOR`. The slug is not printed. */
export const formatLogEvent = (event: LogEvent, output: { isTTY: boolean; NO_COLOR?: string }): string => {
  const word = event.level;
  const head = useColor(output) ? `${DARK}[${LEVEL_COLOR[event.level]}${word}${DARK}]${RESET}` : `[${word}]`;
  const step = event.step === undefined ? "" : useColor(output) ? ` ${CYAN}${event.step}${RESET}` : ` ${event.step}`;
  return `${head}${step} ${event.message}\n`;
};

let editorClient: IpcClient | undefined;
let connecting: Promise<void> | undefined;
let sendChain = Promise.resolve();
let reportedConnect = false;

const reportConnect = (ok: boolean): void => {
  if (reportedConnect) {
    return;
  }
  reportedConnect = true;
  logD(ok ? "connected" : "connect failed", { step: "ipc" });
};

const deliver = async (event: LogEvent, directory: string): Promise<void> => {
  if (connecting === undefined) {
    connecting = connect(socketPath(directory)).then(
      (next) => {
        editorClient = next;
        reportConnect(true);
      },
      () => {
        editorClient = undefined;
        reportConnect(false);
      },
    );
  }
  await connecting;
  if (editorClient === undefined) {
    return;
  }
  const args: Record<string, unknown> = { level: event.level, message: event.message };
  if (event.step !== undefined) {
    args.step = event.step;
  }
  if (event.slug !== undefined) {
    args.slug = event.slug;
  }
  await editorClient.request({ name: "log", args });
};

/**
 * Prints events at or above `level` to stderr. Lower events are dropped.
 * `editor` also sends every event on the project socket.
 * Specification: openspec/specs/variant-cli/logging/spec.md
 */
export const attachLogLevel = (level: LogLevel, editor?: { directory: string }): void => {
  const minimum = RANK[level];
  const directory = editor?.directory;
  editorClient = undefined;
  connecting = undefined;
  sendChain = Promise.resolve();
  reportedConnect = false;
  setLogSink((event: LogEvent) => {
    if (RANK[event.level] >= minimum) {
      process.stderr.write(
        formatLogEvent(event, { isTTY: process.stderr.isTTY === true, NO_COLOR: process.env.NO_COLOR }),
      );
    }
    if (directory === undefined) {
      return;
    }
    sendChain = sendChain.then(() => deliver(event, directory)).catch(() => undefined);
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
