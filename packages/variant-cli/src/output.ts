import { redacted } from "variant-api";
import { configOrigins } from "variant-config";
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
  /** Color config text. Set only when stdout is a terminal and `NO_COLOR` is unset. */
  color?: boolean;
}

/** True when config text should be colored: a terminal, and `NO_COLOR` not set at all. An empty value still disables it. */
export const stdoutColor = (stdout: { isTTY?: boolean }, env: { NO_COLOR?: string }): boolean =>
  stdout.isTTY === true && env.NO_COLOR === undefined;

/** The result of a command as the string the CLI prints for the format, with secrets redacted. */
export const renderOutput = (command: string, result: unknown, options: OutputOptions): string => {
  const safe = redacted(result);
  if (
    command === "config" &&
    safe &&
    typeof safe === "object" &&
    !Array.isArray(safe) &&
    result &&
    typeof result === "object"
  ) {
    Object.defineProperty(safe, "origins", { enumerable: false, configurable: true, value: configOrigins(result) });
  }
  switch (options.format) {
    case "json":
      return JSON.stringify(safe, null, 2);
    case "yaml":
      return stringifyYaml(safe).trimEnd();
    default:
      return renderText(command, safe, options);
  }
};
