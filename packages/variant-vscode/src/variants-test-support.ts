import type { VariantRecord, VariantUpdate } from "variant-api";
import type { ViewClient } from "./variants-client.ts";

/** A record as `list` returns it, with only what a test cares about filled in. */
export const record = (slug: string, extra: Partial<VariantRecord> = {}): VariantRecord => ({
  slug,
  target: "",
  dialect: "sqlite",
  statePath: "",
  createdAt: "",
  exists: true,
  implodeClean: slug !== "main",
  ...extra,
});

/** A library a test drives: records it publishes, the calls it received, and failures it is told to produce. */
export const fakeClient = (initial: VariantRecord[] = []) => {
  let records = initial;
  let failure: string | undefined;
  const listeners = new Set<(update: VariantUpdate) => void>();
  const calls: Array<{ name: string; slug: string; options?: unknown }> = [];
  const act = (name: string) => async (slug: string, options?: unknown) => {
    calls.push({ name, slug, options });
    if (failure !== undefined) {
      const message = failure;
      failure = undefined;
      throw new Error(message);
    }
    return {} as never;
  };
  const client = {
    subscribe: (listener: (update: VariantUpdate) => void) => {
      listeners.add(listener);
      listener({ records });
      return () => listeners.delete(listener);
    },
    watch: act("watch"),
    down: act("down"),
    implode: act("implode"),
    create: async (slug?: string) => {
      calls.push({ name: "create", slug: slug ?? "" });
      if (failure !== undefined) {
        const message = failure;
        failure = undefined;
        throw new Error(message);
      }
      if (slug !== undefined && slug !== "") {
        records = [...records, record(slug)];
      }
      return {} as never;
    },
  } as unknown as ViewClient;
  return {
    client,
    calls,
    listeners,
    publish: (next: VariantRecord[]) => {
      records = next;
      for (const listener of [...listeners]) {
        listener({ records });
      }
    },
    failNext: (message: string) => {
      failure = message;
    },
  };
};
