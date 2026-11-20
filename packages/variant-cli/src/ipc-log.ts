import { LOG_LEVELS, type LogEvent, LogLevel } from "variant-api";

/** A global flag, accepted before or after the command name. */
export const LOG_LEVEL_FLAG = {
  name: "log-level",
  description: "Minimum log level written to stderr: trace, debug, info, warn, error",
} as const;

/** `-v`, `-vv` and `-vvv`: the log level of a run of `v`, so `-v` is `info` and `-vvv` is `trace`. */
export const VERBOSITY_FLAG = {
  name: "v",
  description: "Log at info; -vv at debug, -vvv at trace",
} as const;

const VERBOSITY_LEVELS = [LogLevel.info, LogLevel.debug, LogLevel.trace] as const;

/** The log level of a run of `v` such as `-vv`; a longer run than the levels there are is `trace`. */
const verbosityLevel = (arg: string): LogLevel | undefined =>
  /^-v+$/.test(arg) ? VERBOSITY_LEVELS[Math.min(arg.length - 1, VERBOSITY_LEVELS.length) - 1] : undefined;

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
 * Takes `--log-level`, `-v`, `-vv` and `-vvv` out of the arguments, wherever they stand. A given `--log-level` wins
 * over the `-v` flags; otherwise the level is the most verbose of them, and `warn` without any.
 * An unknown value fails before the command runs. `warning` is accepted as `warn` but never named.
 */
export const takeLogLevel = (argv: string[]): { args: string[]; level: LogLevel } => {
  const args: string[] = [];
  let level: LogLevel | undefined;
  let verbosity: LogLevel | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    const short = verbosityLevel(arg);
    if (short !== undefined) {
      verbosity = verbosity === undefined || RANK[short] < RANK[verbosity] ? short : verbosity;
      continue;
    }
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
      throw new Error(`--log-level must be one of ${LOG_LEVELS.join(", ")}.`);
    }
    level = parsed;
  }
  return { args, level: level ?? verbosity ?? LogLevel.warn };
};

/** One stderr line. Color follows a terminal and an unset `NO_COLOR`. The slug is not printed. */
export const formatLogEvent = (event: LogEvent, output: { isTTY: boolean; NO_COLOR?: string }): string => {
  const word = event.level;
  const head = useColor(output) ? `${DARK}[${LEVEL_COLOR[event.level]}${word}${DARK}]${RESET}` : `[${word}]`;
  const step = event.step === undefined ? "" : useColor(output) ? ` ${CYAN}${event.step}${RESET}` : ` ${event.step}`;
  return `${head}${step} ${event.message}\n`;
};

/** True when `event` is at or above the stderr threshold. */
export const showsOnStderr = (event: LogEvent, minimum: LogLevel): boolean => RANK[event.level] >= RANK[minimum];

/** Writes one event to stderr. The caller decides the threshold. */
export const writeStderrLog = (event: LogEvent): void => {
  process.stderr.write(formatLogEvent(event, { isTTY: process.stderr.isTTY === true, NO_COLOR: process.env.NO_COLOR }));
};
