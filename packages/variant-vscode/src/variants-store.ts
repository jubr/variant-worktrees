import type { MiseFailure, VariantRecord } from "variant-api";
import { type LoadClient, messageOf } from "./variants-client.ts";

/** A down `main` the library did not return. The CLI list never receives this row. */
const syntheticMain = (): VariantRecord => ({
  slug: "main",
  target: "",
  dialect: "sqlite",
  statePath: "",
  createdAt: "",
  exists: true,
  implodeClean: false,
});

const withMain = (incoming: readonly VariantRecord[]): readonly VariantRecord[] =>
  incoming.some((entry) => entry.slug === "main") ? incoming : [syntheticMain(), ...incoming];

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
  /** Set while postgres or mysql cannot be contacted. Absent once contact returns. */
  warning(): string | undefined;
  /** Set with `error` when the last read failed because of Mise. */
  mise(): MiseFailure | undefined;
  pending(): ReadonlySet<string>;
  onDidChange(listener: () => void): () => void;
  /** Subscribes to the library when it is not yet; does nothing while subscribed. Safe to call again. */
  start(): Promise<void>;
  /** Reads again from the start, for after the cause of a failure was removed. */
  restart(): Promise<void>;
  /** Marks `slug` as busy while `task` runs. */
  run<T>(slug: string, task: () => Promise<T>): Promise<T>;
  dispose(): void;
}

export const createVariantsStore = (deps: VariantsStoreDeps): VariantsStore => {
  let records: readonly VariantRecord[] = [];
  let status: StoreStatus = "loading";
  let error: string | undefined;
  let warning: string | undefined;
  let mise: MiseFailure | undefined;
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
        records = update.error === undefined ? withMain(update.records) : update.records;
        error = update.error;
        warning = update.warning;
        mise = update.mise;
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
    warning: () => warning,
    mise: () => mise,
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
    restart: () => {
      stop?.();
      stop = undefined;
      starting = undefined;
      return begin();
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
