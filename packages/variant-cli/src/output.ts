import { redacted } from "variant-api";
import { stringify as stringifyYaml } from "yaml";
import { renderText } from "./text.js";

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
  /** The command ran with `--verbose`; it changes the text layout of `list`. */
  verbose?: boolean;
}

/** The result of a command as the string the CLI prints for the format, with secrets redacted. */
export const renderOutput = (command: string, result: unknown, options: OutputOptions): string => {
  const safe = redacted(result);
  switch (options.format) {
    case "json":
      return JSON.stringify(safe, null, 2);
    case "yaml":
      return stringifyYaml(safe).trimEnd();
    default:
      return renderText(command, safe, options);
  }
};
