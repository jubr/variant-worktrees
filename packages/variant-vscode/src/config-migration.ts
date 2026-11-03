import { join } from "node:path";
import { findConfigFile, LOCAL_FILENAME, loadConfig, type MigrationResult, migrateFile } from "variant-config";
import * as vscode from "vscode";

/**
 * Specification: openspec/specs/variant-vscode/config-migration/spec.md
 */

export interface ConfigMigrationDeps {
  /** The first workspace folder. */
  root: string;
  /** The environment the opt-outs (`CI`, `VARIANT_MIGRATE`) are read from; the process environment by default. */
  env?: NodeJS.ProcessEnv;
}

const OPEN_FILE = "Open file";

const messageFor = (result: MigrationResult): string => {
  const names = result.notices.join("; ");
  if (result.status === "skipped") {
    return `${result.file} uses names of an earlier version and was not rewritten: ${result.reason}. Rename them by hand (${names}).`;
  }
  const how = result.file.endsWith(LOCAL_FILENAME)
    ? "It is git-ignored and written by Variant Worktrees."
    : "Review the change with git diff and revert it with git checkout.";
  return `${result.file} used names of an earlier version and was rewritten. ${how} (${names})`;
};

const openFile = async (file: string): Promise<void> => {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  await vscode.window.showTextDocument(document, { preview: false });
};

/**
 * Rewrites the configuration files of the workspace that use names of an earlier version, best effort, and tells the user
 * with a warning notification that has the action **Open file**. A warning with an action stays until it is closed.
 * Each file is announced once per session. A failure never reaches the caller: the views load on whatever the outcome.
 */
export const createConfigMigration = (deps: ConfigMigrationDeps): { run: () => void } => {
  const announced = new Set<string>();
  return {
    run: () => {
      try {
        const configPath = findConfigFile(deps.root);
        if (configPath === undefined) {
          return;
        }
        const env = deps.env ?? process.env;
        const config = loadConfig({ cwd: deps.root, configPath, env });
        if (config.migrations.length === 0) {
          return;
        }
        for (const file of [config.configPath, join(config.configDir, LOCAL_FILENAME)]) {
          if (announced.has(file)) {
            continue;
          }
          announced.add(file);
          const result = migrateFile(file, env);
          if (result) {
            void Promise.resolve(vscode.window.showWarningMessage(messageFor(result), OPEN_FILE))
              .then((choice) => (choice === OPEN_FILE ? openFile(file) : undefined))
              .catch(() => undefined);
          }
        }
      } catch {
        // a configuration that cannot be loaded or rewritten is reported where it is used, not here
      }
    },
  };
};
