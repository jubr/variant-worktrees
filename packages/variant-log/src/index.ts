/** Specification: openspec/specs/variant-log/events/spec.md */

export enum LogLevel {
  trace = "trace",
  debug = "debug",
  info = "info",
  warn = "warn",
  error = "error",
}

export const LOG_LEVELS = [LogLevel.trace, LogLevel.debug, LogLevel.info, LogLevel.warn, LogLevel.error] as const;

export interface LogEvent {
  level: LogLevel;
  message: string;
  slug?: string;
  step?: string;
}

export type LogSink = (event: LogEvent) => void;

let sink: LogSink | undefined;

export const setLogSink = (next: LogSink | undefined): void => {
  sink = next;
};

export interface LogFields {
  slug?: string;
  step?: string;
}

export const log = (level: LogLevel, message: string, fields?: LogFields): void => {
  if (sink === undefined) return;
  const event: LogEvent = { level, message };
  if (fields?.slug !== undefined) event.slug = fields.slug;
  if (fields?.step !== undefined) event.step = fields.step;
  sink(event);
};

export const logI = (message: string, fields?: LogFields): void => {
  log(LogLevel.info, message, fields);
};

export const logW = (message: string, fields?: LogFields): void => {
  log(LogLevel.warn, message, fields);
};

export const logT = (message: string, fields?: LogFields): void => {
  log(LogLevel.trace, message, fields);
};

export const logD = (message: string, fields?: LogFields): void => {
  log(LogLevel.debug, message, fields);
};

export const logE = (message: string, fields?: LogFields): void => {
  log(LogLevel.error, message, fields);
};
