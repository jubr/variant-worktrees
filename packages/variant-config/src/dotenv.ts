import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResolvedConfig, VariantWatch } from "./schema.js";

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
 * The amended copy of a watch's env file: `<configDir>/<dir>/<env.sourceFile>` (else `<sourceFile>.example`, else
 * empty) with the variant's values applied. Nothing when the watch has no `env.sourceFile`. It does not write the copy.
 */
export const dotenvFor = (
  config: ResolvedConfig,
  watch: VariantWatch,
  entries: Readonly<Record<string, string>>,
): string | undefined => {
  const sourceFile = watch.env?.sourceFile;
  if (sourceFile === undefined) {
    return undefined;
  }
  const path = join(config.configDir, watch.dir, sourceFile);
  const source = [path, `${path}.example`].find((candidate) => existsSync(candidate));
  return amendDotenv(source ? readFileSync(source, "utf8") : "", entries);
};
