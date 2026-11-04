import type { ActivityLog } from "./variants-actions.ts";
import { messageOf } from "./variants-client.ts";

/**
 * Specification: openspec/changes/variant-init-onboarding/specs/tools/mise/spec.md (Mise failures in the editor offer Trust)
 */

/** A failure of Mise as the library reports it: where, Mise's message, and whether `mise trust` fixes it. */
export interface MiseFailureInfo {
  directory: string;
  detail: string;
  untrusted: boolean;
}

/**
 * The failure behind a thrown value, when it is one of Mise. The error class lives in the lazily loaded library, so it
 * is recognized by its name and fields.
 */
export const miseFailureOf = (error: unknown): MiseFailureInfo | undefined => {
  if (!(error instanceof Error) || error.name !== "MiseError") {
    return undefined;
  }
  const { directory, detail, untrusted } = error as Error & Partial<MiseFailureInfo>;
  return typeof directory === "string" && typeof detail === "string"
    ? { directory, detail, untrusted: untrusted === true }
    : undefined;
};

export interface MiseGuardDeps {
  /** Runs `mise -C <directory> trust --all`; rejects with Mise's message when it fails. */
  trust: (directory: string) => Promise<void>;
  showError: (message: string, ...buttons: string[]) => PromiseLike<string | undefined>;
  showInfo: (message: string) => PromiseLike<unknown>;
  log?: ActivityLog;
}

export interface MiseGuard {
  /**
   * Tells the person that Mise failed. One notification per directory and kind of failure per session; an untrusted
   * configuration has the button `Trust`, which trusts, confirms, and runs `retry`.
   */
  report(failure: MiseFailureInfo, retry: () => unknown): void;
  /** `report` for any thrown value; false, and nothing reported, when it is not a failure of Mise. */
  handle(error: unknown, retry: () => unknown): boolean;
  /** Trusts `directory` as the button does; for the dialog. Resolves with the failure message, or nothing on success. */
  trust(directory: string): Promise<string | undefined>;
}

const TRUST = "Trust";

export const createMiseGuard = (deps: MiseGuardDeps): MiseGuard => {
  const reported = new Set<string>();

  const trust = async (directory: string): Promise<string | undefined> => {
    try {
      await deps.trust(directory);
      deps.log?.info("mise trust", { directory });
      void deps.showInfo(`Trusted the Mise configuration of ${directory}`);
      return undefined;
    } catch (error) {
      deps.log?.error("mise trust failed", error, { directory });
      const message = messageOf(error);
      void deps.showError(message);
      return message;
    }
  };

  const report = (failure: MiseFailureInfo, retry: () => unknown): void => {
    const key = `${failure.directory}\u0000${failure.untrusted ? "untrusted" : "failed"}`;
    if (reported.has(key)) {
      return;
    }
    reported.add(key);
    deps.log?.error("mise failed", new Error(failure.detail), { directory: failure.directory });
    void Promise.resolve(
      deps.showError(`Mise failed in ${failure.directory}: ${failure.detail}`, ...(failure.untrusted ? [TRUST] : [])),
    ).then(async (choice) => {
      if (choice !== TRUST) {
        return;
      }
      if ((await trust(failure.directory)) === undefined) {
        reported.delete(key);
        await retry();
      }
    });
  };

  return {
    report,
    handle: (error, retry) => {
      const failure = miseFailureOf(error);
      if (failure === undefined) {
        return false;
      }
      report(failure, retry);
      return true;
    },
    trust,
  };
};
