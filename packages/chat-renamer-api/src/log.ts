/** Values that follow a message as `key=value`. `undefined` entries are left out. */
export type LogFields = Record<string, unknown>;

export type Logger = {
  trace(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, cause?: unknown, fields?: LogFields): void;
  /** A logger whose entries start with `[category]`; categories of nested children are joined with a dot. */
  child(category: string): Logger;
};

/** Where entries go. A `vscode.LogOutputChannel` fits: it adds the timestamp and level itself. */
export type LogSink = {
  trace(message: string): void;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

const errorText = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

const fieldText = (value: unknown): string =>
  typeof value === "string" || (typeof value === "object" && value !== null) ? JSON.stringify(value) : String(value);

const renderFields = (fields: LogFields | undefined): string => {
  const pairs = Object.entries(fields ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${fieldText(value)}`);
  return pairs.length > 0 ? ` ${pairs.join(" ")}` : "";
};

export const createLogger = (sink: LogSink, categories: readonly string[] = []): Logger => {
  const prefix = categories.length > 0 ? `[${categories.join(".")}] ` : "";
  const line = (message: string, fields: LogFields | undefined): string => `${prefix}${message}${renderFields(fields)}`;
  return {
    trace: (message, fields) => sink.trace(line(message, fields)),
    debug: (message, fields) => sink.debug(line(message, fields)),
    info: (message, fields) => sink.info(line(message, fields)),
    warn: (message, fields) => sink.warn(line(message, fields)),
    error: (message, cause, fields) =>
      sink.error(line(cause === undefined ? message : `${message}: ${errorText(cause)}`, fields)),
    child: (category) => createLogger(sink, [...categories, category]),
  };
};

/** Adapts an `appendLine` channel: each entry becomes `<ISO time> LEVEL message`. */
export const lineSink = (appendLine: (line: string) => void, now: () => Date = () => new Date()): LogSink => {
  const write =
    (level: string) =>
    (message: string): void =>
      appendLine(`${now().toISOString()} ${level.padEnd(5)} ${message}`);
  return {
    trace: write("TRACE"),
    debug: write("DEBUG"),
    info: write("INFO"),
    warn: write("WARN"),
    error: write("ERROR"),
  };
};

const noop = (): void => {};

export const silentLogger: Logger = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  child: () => silentLogger,
};
