import { existsSync, readdirSync } from "node:fs";
import { loadConfig } from "variant-config";
import { defaultStateDir, isValidSlug, stateSlugs } from "./state.js";

/**
 * Specification: openspec/specs/variant-cli/completions/spec.md
 *
 * The slugs of existing variants for shell completion: saved variant states plus `<prefix>*` directories below
 * `variant.root`, valid slugs only, sorted and without duplicates. It reads local files and nothing else: no database,
 * no git, no writes, and it does not create a client. Any failure (no or invalid configuration) yields no slugs, so a
 * TAB in an unrelated directory never prints an error.
 */
export const listSlugs = (
  cwd: string = process.cwd(),
  configPath: string | undefined = process.env.VARIANT_CONFIG,
): string[] => {
  try {
    const config = loadConfig({ cwd, ...(configPath ? { configPath } : {}) });
    if (!existsSync(config.configPath)) {
      return [];
    }
    const { prefix, root } = config.variant;
    const worktrees = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
      .map((entry) => entry.name.slice(prefix.length));
    const slugs = new Set([...stateSlugs(defaultStateDir(config.configDir)), ...worktrees].filter(isValidSlug));
    return [...slugs].sort();
  } catch {
    return [];
  }
};
