import type { VariantsAdoption } from "variant-config";
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

export interface NoticeDeps {
  root: string;
  state: Memento;
  /** Adoption of the workspace. `active` skips the notification and does not read the environment. */
  adoption: () => Promise<VariantsAdoption>;
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
 * Offers `variant init` once per workspace, after a local commit, when adoption is `detected`.
 * The shown-record gate runs before adoption, so a recorded workspace does not read the environment.
 */
export const createOnboardingNotice = (deps: NoticeDeps): OnboardingNotice => {
  let running = false;

  const check = async (): Promise<void> => {
    if (running || deps.state.get(SHOWN_KEY) === true) {
      return;
    }
    running = true;
    try {
      const adoption = await deps.adoption();
      if (adoption.status === "active") {
        return;
      }
      if (adoption.status === "none") {
        if (adoption.error !== undefined) {
          deps.guard.handle(adoption.error, check);
        }
        return;
      }
      await deps.state.update(SHOWN_KEY, true);
      deps.log?.info("onboarding notification", { detected: adoption.label });
      running = false;
      const choice = await deps.showInfo(
        `Detected ${adoption.label}, want to bootstrap Variant in this repo?`,
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
