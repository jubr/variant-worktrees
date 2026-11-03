import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  findConfigFile,
  isSchemaHeaderNotice,
  LOCAL_FILENAME,
  loadConfig,
  type MigrationResult,
  migrateFile,
} from "variant-config";
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
const UNDO = "Undo";

const messageFor = (result: MigrationResult): string => {
  const names = result.notices.join("; ");
  if (result.status === "skipped") {
    return `${result.file} is not in the current format and was not rewritten: ${result.reason}. Update it by hand (${names}).`;
  }
  const how = result.file.endsWith(LOCAL_FILENAME)
    ? "It is git-ignored and written by Variant Worktrees."
    : result.backup !== undefined
      ? `It is not tracked by git, so the old text is saved as ${result.backup}.`
      : "Review the change with git diff and revert it with git checkout.";
  return `${result.file} was updated to the current names and format. ${how} (${names})`;
};

const readText = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
};

const openFile = async (file: string): Promise<void> => {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  await vscode.window.showTextDocument(document, { preview: false });
};

/**
 * Puts the text from before the rewrite back, unless the file changed since: then the user's edits win and git is the
 * way to revert. The extension rewrites the file again on its next load unless `VARIANT_MIGRATE=0`.
 */
const undo = (file: string, before: string, after: string, backup: string | undefined): void => {
  try {
    if (readFileSync(file, "utf8") !== after) {
      void vscode.window.showErrorMessage(
        `${file} changed since it was rewritten, so it was left alone. Revert it with git.`,
      );
      return;
    }
    writeFileSync(file, before);
    // the backup this rewrite saved is now redundant, and would keep the next rewrite from saving its own
    if (backup !== undefined && readText(backup) === before) {
      rmSync(backup, { force: true });
    }
    void vscode.window.showInformationMessage(
      `${file} is back to its old names. It is rewritten again when the extension next loads it; set VARIANT_MIGRATE=0 to stop that.`,
    );
  } catch (error) {
    void vscode.window.showErrorMessage(
      `${file} could not be restored: ${error instanceof Error ? error.message : error}`,
    );
  }
};

/**
 * Rewrites the configuration files of the workspace that use names of an earlier version, best effort, and tells the user
 * with a warning notification that has the actions **Open file** and, after a rewrite, **Undo**. A warning with an action stays until it is closed.
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
        for (const file of [config.configPath, join(config.configDir, LOCAL_FILENAME)]) {
          if (announced.has(file)) {
            continue;
          }
          announced.add(file);
          const before = readText(file);
          const result = migrateFile(file, env);
          // a missing schema header is cosmetic: when it cannot be added, there is nothing to tell
          const cosmetic = result?.status === "skipped" && result.notices.every(isSchemaHeaderNotice);
          if (result && !cosmetic) {
            const after = result.status === "rewritten" ? readText(file) : undefined;
            const canUndo = before !== undefined && after !== undefined;
            const actions = canUndo ? [OPEN_FILE, UNDO] : [OPEN_FILE];
            void Promise.resolve(vscode.window.showWarningMessage(messageFor(result), ...actions))
              .then((choice) => {
                if (choice === OPEN_FILE) {
                  return openFile(file);
                }
                if (choice === UNDO && canUndo) {
                  undo(file, before, after, result.status === "rewritten" ? result.backup : undefined);
                }
                return undefined;
              })
              .catch(() => undefined);
          }
        }
      } catch {
        // a configuration that cannot be loaded or rewritten is reported where it is used, not here
      }
    },
  };
};
