import { type FSWatcher, watch as fsWatch } from "node:fs";
import { logI } from "./log.js";
import { MiseError } from "./mise.js";
import type { MiseFailure, VariantRecord, VariantUpdate } from "./types.js";

/** A directory whose entries are watched; `accept` narrows the entry names that count as a change. */
export interface WatchTarget {
  path: string;
  accept?: (filename: string | null) => boolean;
}

export interface StateSubscriptionOptions {
  /** The records of the project, as `list` returns them, plus a contact warning when the database is unreachable. */
  read: () => Promise<VariantRecord[] | { records: VariantRecord[]; warning?: string }>;
  /** The directories to watch right now. Asked again after every read, so new worktrees are picked up. */
  targets: () => WatchTarget[];
  /** Changes that follow each other within this time produce one read. */
  debounceMs?: number;
  /** How often the records are read again although no file changed, to notice a process that ended. */
  livenessIntervalMs?: number;
  /**
   * Delay before the next read while the database cannot be contacted.
   * `attempt` is how many retries of this outage have already been scheduled. The cycle starts again at 0
   * on the first failed attempt after contact.
   */
  contactRetryMs?: (attempt: number) => number;
  watch?: typeof fsWatch;
}

export const DEFAULT_DEBOUNCE_MS = 200;
export const DEFAULT_LIVENESS_INTERVAL_MS = 5000;
export const DEFAULT_CONTACT_RETRY_MAX_MS = 60_000;

/** 1s, 2s, 4s, … capped at one minute. `attempt` 0 is the first retry of an outage. */
export const contactRetryDelay = (attempt: number): number =>
  Math.min(DEFAULT_CONTACT_RETRY_MAX_MS, 1000 * 2 ** attempt);

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
  const contactRetryMs = options.contactRetryMs ?? contactRetryDelay;
  const watch = options.watch ?? fsWatch;
  const subscribers = new Set<Subscriber>();
  const watchers = new Map<string, FSWatcher>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let outage = false;
  let retryAttempt = 0;
  let last: VariantRecord[] | undefined;
  let lastKey: string | undefined;
  let lastError: string | undefined;
  let lastWarning: string | undefined;
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

  const clearRetry = (): void => {
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
  };

  /** One quiet retry. A timer already waiting is left alone so a file change cannot restart the delay. */
  const armRetry = (): void => {
    if (retryTimer !== undefined || subscribers.size === 0) {
      return;
    }
    const delay = contactRetryMs(retryAttempt);
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void refresh();
    }, delay);
    retryTimer.unref?.();
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
      let warning: string | undefined;
      let failure: string | undefined;
      let mise: MiseFailure | undefined;
      try {
        const outcome = await options.read();
        if (Array.isArray(outcome)) {
          next = outcome;
        } else {
          next = outcome.records;
          warning = outcome.warning;
        }
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
          lastWarning = undefined;
          broadcast({
            records: last ?? [],
            ...(failure === undefined ? {} : { error: failure }),
            ...(mise === undefined ? {} : { mise }),
          });
        }
      } else {
        const key = withoutUptime(next);
        const changed = last === undefined || key !== lastKey || lastError !== undefined || lastWarning !== warning;
        last = next;
        lastKey = key;
        lastError = undefined;
        lastMise = undefined;
        const recovered = outage && warning === undefined;
        if (warning !== undefined) {
          if (!outage) {
            outage = true;
            retryAttempt = 0;
            clearRetry();
          }
        } else if (outage) {
          outage = false;
          retryAttempt = 0;
          clearRetry();
        }
        lastWarning = warning;
        if (changed) {
          broadcast({ records: next, ...(warning === undefined ? {} : { warning }) });
        }
        if (recovered) {
          logI("database contact restored");
        }
        if (warning !== undefined) {
          armRetry();
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
    timer = setInterval(() => {
      if (!outage) {
        schedule();
      }
    }, livenessIntervalMs);
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
    clearRetry();
    outage = false;
    retryAttempt = 0;
    last = undefined;
    lastKey = undefined;
    lastError = undefined;
    lastWarning = undefined;
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
          ...(lastWarning === undefined ? {} : { warning: lastWarning }),
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
