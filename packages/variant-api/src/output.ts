import { stringify as stringifyYaml } from "yaml";
import { formatTable } from "./table.js";
import type { VariantRecord } from "./types.js";

/** How the CLI prints a command result: a text summary for people, or the result as JSON or YAML. */
export type OutputFormat = "text" | "json" | "yaml";

/** Flags that every command accepts and that only choose the output format. */
export const GLOBAL_FLAGS = [
  { name: "json", description: "Print the result as JSON" },
  { name: "yaml", description: "Print the result as YAML" },
] as const;

export interface OutputOptions {
  format: OutputFormat;
  /** The variant root, for directories shown relative to it. */
  variantRoot: string;
}

/** The value with every non-empty `password` replaced by `***`, at any depth. */
export const redacted = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redacted);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    copy[key] = key === "password" && child ? "***" : redacted(child);
  }
  return copy;
};

const isScalar = (value: unknown): boolean => value === null || typeof value !== "object";

const isEmpty = (value: unknown): boolean =>
  Array.isArray(value) ? value.length === 0 : typeof value === "object" && Object.keys(value as object).length === 0;

const scalarLines = (value: unknown, pad: string): string[] =>
  typeof value === "string" && value.includes("\n")
    ? value
        .trimEnd()
        .split("\n")
        .map((line) => `${pad}  ${line}`)
    : [];

/** Any value as indented `key: value` lines; arrays as `- item` lines. The text form of a result without a layout. */
export const outline = (value: unknown, indent = 0): string[] => {
  const pad = "  ".repeat(indent);
  if (isScalar(value)) {
    return [`${pad}${String(value ?? "-")}`];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      isScalar(item) ? [`${pad}- ${String(item ?? "-")}`] : [`${pad}-`, ...outline(item, indent + 1)],
    );
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    if (isScalar(child)) {
      const multiline = scalarLines(child, pad);
      return multiline.length > 0 ? [`${pad}${key}:`, ...multiline] : [`${pad}${key}: ${String(child ?? "-")}`];
    }
    return isEmpty(child) ? [`${pad}${key}: -`] : [`${pad}${key}:`, ...outline(child, indent + 1)];
  });
};

const textLayouts: Record<string, (result: unknown, options: OutputOptions) => string> = {
  list: (result, { variantRoot }) => formatTable(result as VariantRecord[], variantRoot),
};

/** The text a command result is printed as: its own layout, else the outline. */
const text = (command: string, result: unknown, options: OutputOptions): string =>
  textLayouts[command]?.(result, options) ?? outline(result).join("\n");

/** The result of a command as the string the CLI prints for the format, with secrets redacted. */
export const renderOutput = (command: string, result: unknown, options: OutputOptions): string => {
  const safe = redacted(result);
  switch (options.format) {
    case "json":
      return JSON.stringify(safe, null, 2);
    case "yaml":
      return stringifyYaml(safe).trimEnd();
    default:
      return text(command, safe, options);
  }
};
