/** Specification: openspec/specs/variant-api/logging/spec.md */

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LogEvent {
  level: LogLevel;
  message: string;
}

export type LogSink = (event: LogEvent) => void;

let sink: LogSink | undefined;

/** Attaches the host that receives log events. `undefined` drops them. */
export const setLogSink = (next: LogSink | undefined): void => {
  sink = next;
};

/** Emits one event. With no host attached, the event is dropped. */
export const log = (level: LogLevel, message: string): void => {
  sink?.({ level, message });
};
