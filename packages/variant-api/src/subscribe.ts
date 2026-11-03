import { type FSWatcher, watch as fsWatch } from "node:fs";
import { MiseError } from "./mise.js";
import type { MiseFailure, VariantRecord, VariantUpdate } from "./types.js";

/** A directory whose entries are watched; `accept` narrows the entry names that count as a change. */
export interface WatchTarget {
  path: string;
  accept?: (filename: string | null) => boolean;
}

export interface StateSubscriptionOptions {
  /** The records of the project, as `list` returns them. */
  read: () => Promise<VariantRecord[]>;
  /** The directories to watch right now. Asked again after every read, so new worktrees are picked up. */
  targets: () => WatchTarget[];
  /** Changes that follow each other within this time produce one read. */
  debounceMs?: number;
  /** How often the records are read again although no file changed, to notice a process that ended. */
  livenessIntervalMs?: number;
  watch?: typeof fsWatch;
}

export const DEFAULT_DEBOUNCE_MS = 200;
export const DEFAULT_LIVENESS_INTERVAL_MS = 5000;

/** The records without any `uptimeSeconds`, which grows with every read and is no change. */
const withoutUptime = (records: VariantRecord[]): string =>
  JSON.stringify(records, (key, value: unknown) => (key === "uptimeSeconds" ? undefined : value));

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const miseOf = (error: unknown): MiseFailure | undefined =>
  error instanceof MiseError
    ? { directory: error.directory, detail: error.detail, untrusted: error.untrusted }
    : undefined;

interface Subscriber {
  listener: (update: VariantUpdate) => void;
  ended: boolean;
}

/**
 * One state subscription service: watchers, timer and last set exist once for all subscribers and only while there is a
 * subscriber. Delivery happens when the records differ from the last set (ignoring `uptimeSeconds`), or when a read
 * fails or recovers.
 */
export const createStateSubscriptions = (options: StateSubscriptionOptions) => {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const livenessIntervalMs = options.livenessIntervalMs ?? DEFAULT_LIVENESS_INTERVAL_MS;
  const watch = options.watch ?? fsWatch;
  const subscribers = new Set<Subscriber>();
  const watchers = new Map<string, FSWatcher>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let last: VariantRecord[] | undefined;
  let lastKey: string | undefined;
  let lastError: string | undefined;
  let lastMise: MiseFailure | undefined;
  let reading = false;
  let readAgain = false;

  const deliver = (subscriber: Subscriber, update: VariantUpdate): void => {
    if (subscriber.ended) {
      return;
    }
    try {
      subscriber.listener(update);
    } catch {
      // A failing listener must not keep the others from their delivery.
    }
  };

  const broadcast = (update: VariantUpdate): void => {
    for (const subscriber of [...subscribers]) {
      deliver(subscriber, update);
    }
  };

  const schedule = (): void => {
    if (pending !== undefined || subscribers.size === 0) {
      return;
    }
    pending = setTimeout(() => {
      pending = undefined;
      void refresh();
    }, debounceMs);
  };

  const arm = (): void => {
    const wanted = new Map<string, ((filename: string | null) => boolean)[]>();
    for (const target of options.targets()) {
      wanted.set(target.path, [...(wanted.get(target.path) ?? []), target.accept ?? (() => true)]);
    }
    for (const [path, watcher] of watchers) {
      if (!wanted.has(path)) {
        watcher.close();
        watchers.delete(path);
      }
    }
    for (const [path, accepts] of wanted) {
      if (watchers.has(path)) {
        continue;
      }
      try {
        const watcher = watch(path, (_event, filename) => {
          const name = filename === null || filename === undefined ? null : String(filename);
          if (accepts.some((accept) => accept(name))) {
            schedule();
          }
        });
        watcher.on("error", () => {
          watcher.close();
          if (watchers.get(path) === watcher) {
            watchers.delete(path);
          }
          schedule();
        });
        watchers.set(path, watcher);
      } catch {
        // A directory that is gone or cannot be watched is covered by the liveness timer.
      }
    }
  };

  const refresh = async (): Promise<void> => {
    if (reading) {
      readAgain = true;
      return;
    }
    reading = true;
    try {
      let next: VariantRecord[] | undefined;
      let failure: string | undefined;
      let mise: MiseFailure | undefined;
      try {
        next = await options.read();
      } catch (error) {
        failure = messageOf(error);
        mise = miseOf(error);
      }
      if (subscribers.size === 0) {
        return;
      }
      if (next === undefined) {
        if (failure !== lastError) {
          lastError = failure;
          lastMise = mise;
          broadcast({
            records: last ?? [],
            ...(failure === undefined ? {} : { error: failure }),
            ...(mise === undefined ? {} : { mise }),
          });
        }
      } else {
        const key = withoutUptime(next);
        const changed = last === undefined || key !== lastKey || lastError !== undefined;
        last = next;
        lastKey = key;
        lastError = undefined;
        lastMise = undefined;
        if (changed) {
          broadcast({ records: next });
        }
      }
      arm();
    } finally {
      reading = false;
      if (readAgain) {
        readAgain = false;
        schedule();
      }
    }
  };

  const start = (): void => {
    arm();
    timer = setInterval(schedule, livenessIntervalMs);
    timer.unref?.();
    void refresh();
  };

  const stop = (): void => {
    for (const watcher of watchers.values()) {
      watcher.close();
    }
    watchers.clear();
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
    if (pending !== undefined) {
      clearTimeout(pending);
      pending = undefined;
    }
    last = undefined;
    lastKey = undefined;
    lastError = undefined;
    lastMise = undefined;
  };

  return {
    /** Delivers the current records, then every change, until the returned function is called. */
    subscribe: (listener: (update: VariantUpdate) => void): (() => void) => {
      const subscriber: Subscriber = { listener, ended: false };
      subscribers.add(subscriber);
      if (subscribers.size === 1) {
        start();
      } else if (last !== undefined) {
        const update: VariantUpdate = {
          records: last,
          ...(lastError === undefined ? {} : { error: lastError }),
          ...(lastMise === undefined ? {} : { mise: lastMise }),
        };
        queueMicrotask(() => deliver(subscriber, update));
      }
      return () => {
        subscriber.ended = true;
        if (subscribers.delete(subscriber) && subscribers.size === 0) {
          stop();
        }
      };
    },
  };
};
