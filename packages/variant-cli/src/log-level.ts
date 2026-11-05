import { LOG_LEVELS, type LogEvent, type LogLevel, setLogSink } from "variant-api";

/** A global flag, accepted before or after the command name. `warning` selects `warn`. */
export const LOG_LEVEL_FLAG = {
  name: "log-level",
  description: "Minimum log level written to stderr: trace, debug, info, warn, error (warning selects warn)",
} as const;

const NAMES = [...LOG_LEVELS, "warning"] as const;

const RANK: Record<LogLevel, number> = { trace: 0, debug: 1, info: 2, warn: 3, error: 4 };

const PREFIX: Record<LogLevel, string> = {
  trace: "trace",
  debug: "debug",
  info: "info",
  warn: "warning",
  error: "error",
};

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

/** Prints events at or above `level` to stderr. Lower events are dropped. */
export const attachLogLevel = (level: LogLevel): void => {
  const minimum = RANK[level];
  setLogSink((event: LogEvent) => {
    if (RANK[event.level] < minimum) {
      return;
    }
    process.stderr.write(`${PREFIX[event.level]}: ${event.message}\n`);
  });
};
