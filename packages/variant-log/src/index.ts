/** Specification: openspec/specs/variant-log/events/spec.md */

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

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
  log("info", message, fields);
};

export const logW = (message: string, fields?: LogFields): void => {
  log("warn", message, fields);
};

export const logT = (message: string, fields?: LogFields): void => {
  log("trace", message, fields);
};

export const logD = (message: string, fields?: LogFields): void => {
  log("debug", message, fields);
};

export const logE = (message: string, fields?: LogFields): void => {
  log("error", message, fields);
};
