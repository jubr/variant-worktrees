import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResolvedConfig, VariantInstance } from "./schema.js";

const ASSIGNMENT = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)=/;

const format = (value: string): string => (/[\s#]/.test(value) ? JSON.stringify(value) : value);

/**
 * The lines of a dotenv file with each given variable replaced in place and each missing one appended. Other lines and
 * comments are kept. Values holding whitespace or `#` are quoted.
 */
export const amendDotenv = (source: string, entries: Readonly<Record<string, string>>): string => {
  const lines = source === "" ? [] : source.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  const written = new Set<string>();
  const amended = lines.map((line) => {
    const match = ASSIGNMENT.exec(line);
    const key = match?.[2];
    if (match && key !== undefined && key in entries) {
      written.add(key);
      return `${match[1]}${key}=${format(entries[key] as string)}`;
    }
    return line;
  });
  for (const [key, value] of Object.entries(entries)) {
    if (!written.has(key)) {
      amended.push(`${key}=${format(value)}`);
    }
  }
  return amended.length === 0 ? "" : `${amended.join("\n")}\n`;
};

/**
 * The amended copy of an instance's dotenv file: `<configDir>/<dir>/<dotenv>` (else `<dotenv>.example`, else empty) with the
 * variant's values applied. Nothing when the instance has no `dotenv`. It does not write the copy.
 */
export const dotenvFor = (
  config: ResolvedConfig,
  instance: VariantInstance,
  entries: Readonly<Record<string, string>>,
): string | undefined => {
  if (instance.dotenv === undefined) {
    return undefined;
  }
  const path = join(config.configDir, instance.dir, instance.dotenv);
  const source = [path, `${path}.example`].find((candidate) => existsSync(candidate));
  return amendDotenv(source ? readFileSync(source, "utf8") : "", entries);
};
