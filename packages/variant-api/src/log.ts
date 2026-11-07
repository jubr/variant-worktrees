/** Specification: openspec/specs/variant-api/logging/spec.md */

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LogEvent {
  level: LogLevel;
  message: string;
  /** Set when the line belongs to one variant. Hosts that show a slug put it first. */
  slug?: string;
}

export type LogSink = (event: LogEvent) => void;

let sink: LogSink | undefined;

/** Attaches the host that receives log events. `undefined` drops them. */
export const setLogSink = (next: LogSink | undefined): void => {
  sink = next;
};

/** Emits one event. With no host attached, the event is dropped. `slug` stays off the message. */
export const log = (level: LogLevel, message: string, slug?: string): void => {
  sink?.(slug === undefined ? { level, message } : { level, message, slug });
};
