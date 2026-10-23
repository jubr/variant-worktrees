import { createLogger, type Logger, silentLogger } from "chat-renamer-api";

export type LogEntry = { level: "trace" | "debug" | "info" | "warn" | "error"; message: string };

/** A logger that discards everything. */
export const quiet: Logger = silentLogger;

/** A logger that keeps every entry, as the log channel would receive it. */
export const captureLog = (): { log: Logger; entries: LogEntry[]; lines: string[] } => {
  const entries: LogEntry[] = [];
  const at = (level: LogEntry["level"]) => (message: string) => {
    entries.push({ level, message });
  };
  const log = createLogger({
    trace: at("trace"),
    debug: at("debug"),
    info: at("info"),
    warn: at("warn"),
    error: at("error"),
  });
  return {
    log,
    entries,
    get lines() {
      return entries.map((entry) => entry.message);
    },
  };
};
