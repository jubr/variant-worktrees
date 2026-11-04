import type { MiseGuard } from "./mise-guard.ts";
import type { ActivityLog } from "./variants-actions.ts";

/**
 * Specification: openspec/changes/variant-init-onboarding/specs/variant-vscode/onboarding/spec.md
 * (One-time onboarding notification)
 */

export const ONBOARDING_COMMAND = "variant.onboardingInit";
export const BOOTSTRAP_BUTTON = "Bootstrap Variant";
/** The `workspaceState` key that records the notification was shown. */
export const SHOWN_KEY = "variant.onboarding.shown";

export interface Memento {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}

/** A detected label, or an environment failure. `active` adoption is represented by no label. */
export interface OnboardingDetection {
  label: string | undefined;
  error?: unknown;
}

export interface NoticeDeps {
  root: string;
  state: Memento;
  /** Whether a `variants.yaml` or `variants.yml` is found for the workspace root. */
  hasConfig: () => boolean;
  /** What autodetection finds for the workspace; a failure of the environment is in `error`. */
  detect: () => Promise<OnboardingDetection>;
  showInfo: (message: string, ...buttons: string[]) => PromiseLike<string | undefined>;
  runCommand: (id: string) => PromiseLike<unknown>;
  guard: MiseGuard;
  log?: ActivityLog;
}

export interface OnboardingNotice {
  /** The gates, then the notification; called for every local commit. */
  check(): Promise<void>;
}

/**
 * Offers `variant init` once per workspace, after a local commit, when there is no `variants.yaml` and autodetection
 * finds both a database and an application. The gates run in the order that keeps the Mise process for last.
 */
export const createOnboardingNotice = (deps: NoticeDeps): OnboardingNotice => {
  let running = false;

  const check = async (): Promise<void> => {
    if (running || deps.state.get(SHOWN_KEY) === true || deps.hasConfig()) {
      return;
    }
    running = true;
    try {
      const detection = await deps.detect();
      if (detection.error !== undefined) {
        deps.guard.handle(detection.error, check);
        return;
      }
      if (detection.label === undefined) {
        return;
      }
      await deps.state.update(SHOWN_KEY, true);
      deps.log?.info("onboarding notification", { detected: detection.label });
      running = false;
      const choice = await deps.showInfo(
        `Detected ${detection.label}, want to bootstrap Variant in this repo?`,
        BOOTSTRAP_BUTTON,
      );
      if (choice === BOOTSTRAP_BUTTON) {
        await deps.runCommand(ONBOARDING_COMMAND);
      }
    } finally {
      running = false;
    }
  };

  return { check };
};
