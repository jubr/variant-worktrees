import { findConfigFile, getVariantsAdoption, resolveMiseBinary } from "variant-config";
import * as vscode from "vscode";
import { createMiseGuard, type MiseGuard } from "./mise-guard.ts";
import { type CommitWatcher, createCommitWatcher } from "./onboarding-commits.ts";
import { createOnboardingNotice, type OnboardingDetection, type OnboardingNotice } from "./onboarding-notice.ts";
import { type Onboarding, registerOnboarding } from "./onboarding-view.ts";
import type { ActivityLog } from "./variants-actions.ts";
import type { VariantsView } from "./variants-view.ts";

/**
 * Specification: openspec/changes/variant-init-onboarding/specs/variant-vscode/onboarding/spec.md and
 * specs/tools/mise/spec.md. Ties the commit watcher, the one-time notification, the dialog and the Mise failure
 * guard to the Variants view.
 */

/** The editor setting `variant.mise.binPath`; empty or blank is not set. Read at every use, so a change applies at once. */
export const miseBinPathSetting = (): string | undefined => {
  const value = vscode.workspace.getConfiguration("variant").get("mise.binPath");
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

export interface OnboardingFlowDeps {
  /** The first workspace folder. */
  root: string;
  view: VariantsView;
  log?: ActivityLog;
  /** Starts watching for commits; the `HEAD` reflog by default. */
  watchCommits?: (root: string, onCommit: () => void) => CommitWatcher;
  /** What autodetection finds; reads the environment through Mise by default. */
  detect?: () => Promise<OnboardingDetection>;
  /** Runs `mise trust --all` in a directory; the resolved Mise by default. */
  trust?: (directory: string) => Promise<void>;
  nonce?: () => string;
}

export interface OnboardingFlow {
  onboarding: Onboarding;
  guard: MiseGuard;
  notice: OnboardingNotice;
}

const NOT_FOUND = "Mise was not found. Set the setting variant.mise.binPath to its executable.";

const detectThroughMise = async (root: string): Promise<OnboardingDetection> => {
  try {
    const { miseEnvironment } = await import("variant-api");
    const binary = resolveMiseBinary({ configured: miseBinPathSetting() });
    const adoption = getVariantsAdoption(root, miseEnvironment({ directory: root, binary }));
    if (adoption.status === "detected") {
      return { label: adoption.label };
    }
    if (adoption.status === "none" && adoption.error !== undefined) {
      return { label: undefined, error: adoption.error };
    }
    return { label: undefined };
  } catch (error) {
    return { label: undefined, error };
  }
};

const trustThroughMise = async (directory: string): Promise<void> => {
  const binary = resolveMiseBinary({ configured: miseBinPathSetting() });
  if (binary === undefined) {
    throw new Error(NOT_FOUND);
  }
  const { runMiseTrust } = await import("variant-api");
  runMiseTrust({ directory, binary });
};

export const registerOnboardingFlow = (context: vscode.ExtensionContext, deps: OnboardingFlowDeps): OnboardingFlow => {
  const { root, view, log } = deps;
  const hasConfig = (): boolean => findConfigFile(root) !== undefined;
  const guard = createMiseGuard({
    trust: deps.trust ?? trustThroughMise,
    showError: (message, ...buttons) => vscode.window.showErrorMessage(message, ...buttons),
    showInfo: (message) => vscode.window.showInformationMessage(message),
    ...(log ? { log } : {}),
  });

  const onboarding = registerOnboarding(context, {
    extensionUri: context.extensionUri,
    loadClient: view.loadClient,
    store: view.store,
    guard,
    hasConfig,
    ...(log ? { log } : {}),
    ...(deps.nonce ? { nonce: deps.nonce } : {}),
  });

  const notice = createOnboardingNotice({
    root,
    state: context.workspaceState,
    hasConfig,
    detect: deps.detect ?? (() => detectThroughMise(root)),
    showInfo: (message, ...buttons) => vscode.window.showInformationMessage(message, ...buttons),
    runCommand: (id) => vscode.commands.executeCommand(id),
    guard,
    ...(log ? { log } : {}),
  });
  const watcher = (deps.watchCommits ?? ((directory, onCommit) => createCommitWatcher({ root: directory, onCommit })))(
    root,
    () => void notice.check(),
  );

  // A read of the variants that failed because of Mise: one notification, and a fresh read after Trust.
  const unsubscribe = view.store.onDidChange(() => {
    const failure = view.store.mise();
    if (failure !== undefined) {
      guard.report(failure, () => view.store.restart());
    }
  });

  context.subscriptions.push({
    dispose: () => {
      watcher.dispose();
      unsubscribe();
    },
  });
  return { onboarding, guard, notice };
};
