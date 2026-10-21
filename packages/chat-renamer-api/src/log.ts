export type Logger = {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, cause?: unknown): void;
};

const errorText = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

export const createLogger = (sink: { appendLine(line: string): void }, now: () => Date = () => new Date()): Logger => {
  const write = (level: string, message: string): void => {
    sink.appendLine(`${now().toISOString()} ${level.padEnd(5)} ${message}`);
  };
  return {
    info: (message) => write("INFO", message),
    warn: (message) => write("WARN", message),
    error: (message, cause) => write("ERROR", cause === undefined ? message : `${message}: ${errorText(cause)}`),
  };
};

export const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
