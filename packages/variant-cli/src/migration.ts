import { join } from "node:path";
import { LOCAL_FILENAME, type MigrationResult, migrateFile, type ResolvedConfig } from "variant-config";

/**
 * Specification: openspec/specs/variant-cli/config-migration/spec.md
 */

const handled = new Set<string>();

const describeResult = (result: MigrationResult): string[] => {
  const notices = result.notices.map((notice) => `  ${notice}`);
  if (result.status === "skipped") {
    return [
      `warning: ${result.file} uses names of an earlier version and was not rewritten: ${result.reason}.`,
      ...notices,
      "  Rename them by hand; until then the file is read under the current names.",
    ];
  }
  if (result.file.endsWith(LOCAL_FILENAME)) {
    return [`migrated ${result.file}: names of an earlier version now use the current ones.`, ...notices];
  }
  return [
    `migrated ${result.file}: names of an earlier version now use the current ones.`,
    ...notices,
    `  The file is tracked by git: review the change with \`git diff -- ${result.file}\` and revert it with \`git checkout -- ${result.file}\`.`,
  ];
};

/**
 * Best-effort rewrite of the configuration files that use names of an earlier version (`variant.instances`,
 * `runtime.instances`, `variant.reservedPorts`), and a report on standard error, once per process and file. The command
 * that called it runs on whatever the outcome. Only this CLI writes: the library, the MCP server and `variant ui` do not.
 */
export const migrateConfigFiles = (
  config: ResolvedConfig,
  env: NodeJS.ProcessEnv = process.env,
  print: (line: string) => void = (line) => console.error(line),
): void => {
  if (config.migrations.length === 0) {
    return;
  }
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
