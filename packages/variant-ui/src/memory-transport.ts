import type { Variant } from "./model.js";
import type { VariantSort } from "./sort.js";
import type { ConnectionState, Transport } from "./transport.js";

export type ActionName = "watch" | "down" | "implode" | "showOutput";

export interface ReceivedAction {
  action: ActionName;
  slug: string;
  confirm?: boolean;
}

/** The side of a memory transport that a test or a story plays: the host. */
export interface MemoryHost {
  publish(records: readonly Variant[]): void;
  setState(state: ConnectionState): void;
  /** The actions the app has asked for, in order. */
  readonly received: ReceivedAction[];
  /** The next action rejects with this message. */
  failNext(message: string): void;
  /** Holds every action until `release` is called, to look at the pending state. */
  hold(): { release: () => void };
  /** The order the app should list variants in. */
  setSort(sort: VariantSort): void;
}

export interface MemoryTransport extends Transport {
  readonly host: MemoryHost;
}

/** A transport backed by memory: the app and a test or a story talk through it without an editor or a server. */
export const createMemoryTransport = (
  initial: readonly Variant[] = [],
  origin: Transport["origin"] = "editor",
): MemoryTransport => {
  let records: readonly Variant[] = initial;
  let sort: VariantSort = "name-asc";
  let state: ConnectionState = "connected";
  let failure: string | undefined;
  let held: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const received: ReceivedAction[] = [];
  const notify = (): void => {
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const act = async (entry: ReceivedAction): Promise<void> => {
    received.push(entry);
    await held;
    if (failure !== undefined) {
      const message = failure;
      failure = undefined;
      throw new Error(message);
    }
  };

  return {
    origin,
    records: () => records,
    sort: () => sort,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    state: () => state,
    watch: (slug) => act({ action: "watch", slug }),
    down: (slug) => act({ action: "down", slug }),
    implode: (slug, confirm) => act({ action: "implode", slug, confirm }),
    showOutput: (slug) => act({ action: "showOutput", slug }),
    host: {
      publish: (next) => {
        records = next;
        notify();
      },
      setState: (next) => {
        state = next;
        notify();
      },
      received,
      failNext: (message) => {
        failure = message;
      },
      setSort: (next) => {
        sort = next;
        notify();
      },
      hold: () => {
        let release = (): void => {};
        held = new Promise<void>((resolve) => {
          release = () => {
            held = undefined;
            resolve();
          };
        });
        return { release };
      },
    },
  };
};
