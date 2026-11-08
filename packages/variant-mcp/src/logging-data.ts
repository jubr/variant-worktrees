import type { LogEvent } from "variant-log";

/** Specification: openspec/specs/variant-mcp/logging/spec.md */
export const loggingData = (event: LogEvent): { message: string; step?: string; slug?: string; level?: "trace" } => {
  const data: { message: string; step?: string; slug?: string; level?: "trace" } = { message: event.message };
  if (event.step !== undefined) {
    data.step = event.step;
  }
  if (event.slug !== undefined) {
    data.slug = event.slug;
  }
  if (event.level === "trace") {
    data.level = "trace";
  }
  return data;
};
