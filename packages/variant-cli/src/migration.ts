import { join } from "node:path";
import {
  isSchemaHeaderNotice,
  LOCAL_FILENAME,
  type MigrationResult,
  migrateFile,
  type ResolvedConfig,
} from "variant-config";

/**
 * Specification: openspec/specs/variant-cli/config-migration/spec.md
 */

const handled = new Set<string>();

const describeResult = (result: MigrationResult): string[] => {
  const notices = result.notices.map((notice) => `  ${notice}`);
  // a missing schema header is cosmetic: a skipped rewrite of nothing else is not worth a line on every command
  if (result.status === "skipped" && result.notices.every(isSchemaHeaderNotice)) {
    return [];
  }
  if (result.status === "skipped") {
    return [
      `warning: ${result.file} uses names of an earlier version and was not rewritten: ${result.reason}.`,
      ...notices,
      "  Rename them by hand; until then the file is read under the current names.",
    ];
  }
  if (result.file.endsWith(LOCAL_FILENAME)) {
    return [`migrated ${result.file}: updated to the current names and format.`, ...notices];
  }
  if (result.backup !== undefined) {
    return [
      `migrated ${result.file}: updated to the current names and format.`,
      ...notices,
      `  The file is not tracked by git, so git cannot revert the change: the old text is saved as ${result.backup}.`,
    ];
  }
  return [
    `migrated ${result.file}: updated to the current names and format.`,
    ...notices,
    `  The file is tracked by git: review the change with \`git diff -- ${result.file}\` and revert it with \`git checkout -- ${result.file}\`.`,
  ];
};

/**
 * Best-effort rewrite of the configuration files that use names of an earlier version (`variant.instances`,
 * `runtime.instances`, `variant.reservedPorts`) or lack the schema header, and a report on standard error, once per process and file. The command
 * that called it runs on whatever the outcome. Only this CLI writes: the library, the MCP server and `variant ui` do not.
 */
export const migrateConfigFiles = (
  config: ResolvedConfig,
  env: NodeJS.ProcessEnv = process.env,
  print: (line: string) => void = (line) => console.error(line),
): void => {
  for (const file of [config.configPath, join(config.configDir, LOCAL_FILENAME)]) {
    if (handled.has(file)) {
      continue;
    }
    handled.add(file);
    const result = migrateFile(file, env);
    if (result) {
      for (const line of describeResult(result)) {
        print(line);
      }
    }
  }
};
