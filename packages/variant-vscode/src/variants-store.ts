import type { VariantRecord } from "variant-api";
import { type LoadClient, messageOf } from "./variants-client.ts";

export type StoreStatus = "loading" | "no-config" | "error" | "empty" | "ready";

export interface VariantsStoreDeps {
  loadClient: LoadClient;
  /** Whether the project has a `variants.yaml`; asked again on every `start`. */
  hasConfig: () => boolean;
}

/**
 * What the Variants view shows: the records of the state subscription of the library, the slugs that have an action
 * running, and why there is nothing to show when there is not.
 */
export interface VariantsStore {
  records(): readonly VariantRecord[];
  status(): StoreStatus;
  /** The reason the library failed to load, or the last read failed. */
  error(): string | undefined;
  pending(): ReadonlySet<string>;
  onDidChange(listener: () => void): () => void;
  /** Subscribes to the library when it is not yet; does nothing while subscribed. Safe to call again. */
  start(): Promise<void>;
  /** Marks `slug` as busy while `task` runs. */
  run<T>(slug: string, task: () => Promise<T>): Promise<T>;
  dispose(): void;
}

export const createVariantsStore = (deps: VariantsStoreDeps): VariantsStore => {
  let records: readonly VariantRecord[] = [];
  let status: StoreStatus = "loading";
  let error: string | undefined;
  let stop: (() => void) | undefined;
  let starting: Promise<void> | undefined;
  let pending: ReadonlySet<string> = new Set();
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const begin = async (): Promise<void> => {
    if (!deps.hasConfig()) {
      status = "no-config";
      records = [];
      notify();
      return;
    }
    try {
      const client = await deps.loadClient();
      stop = client.subscribe((update) => {
        records = update.records;
        error = update.error;
        status = records.length === 0 ? "empty" : "ready";
        notify();
      });
    } catch (failure) {
      error = messageOf(failure);
      status = "error";
      notify();
    }
  };

  return {
    records: () => records,
    status: () => status,
    error: () => error,
    pending: () => pending,
    onDidChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: () => {
      if (stop === undefined) {
        starting ??= begin().finally(() => {
          starting = undefined;
        });
      }
      return starting ?? Promise.resolve();
    },
    run: async (slug, task) => {
      pending = new Set(pending).add(slug);
      notify();
      try {
        return await task();
      } finally {
        const next = new Set(pending);
        next.delete(slug);
        pending = next;
        notify();
      }
    },
    dispose: () => {
      stop?.();
      stop = undefined;
      listeners.clear();
    },
  };
};
