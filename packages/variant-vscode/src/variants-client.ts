import type { VariantClient, VariantRecord } from "variant-api";

/** What the view, the panel and the onboarding dialog need of the library: the state subscription, the three actions and `init`. */
export type ViewClient = Pick<VariantClient, "subscribe" | "watch" | "down" | "implode" | "init">;

/** Loads the library. `cwd` is the directory an action runs in; omitted, it is the workspace folder the view lists. */
export type LoadClient = (cwd?: string) => Promise<ViewClient>;

/** The message of anything thrown, for a notification or a row. */
export const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The library for the project at `cwd`, loaded on first use.
 *
 * AIDEV-NOTE: variant-api is imported lazily. Where its sqlite module is missing (an editor host older than the one
 * `engines.vscode` asks for, or a remote host), the import fails here and the view shows why, instead of the whole
 * extension failing to activate. A failed load is not remembered, so the next use tries again.
 */
export const loadVariantClient = (
  fallback: string,
  miseBinPath: () => string | undefined = () => undefined,
): LoadClient => {
  const clients = new Map<string, Promise<ViewClient>>();
  return (cwd = fallback) => {
    // The setting `variant.mise.binPath` applies to the next call: a client made with another value is made anew.
    const configured = miseBinPath();
    const key = `${cwd}\0${configured ?? ""}`;
    const cached = clients.get(key);
    if (cached) {
      return cached;
    }
    const loading = import("variant-api")
      .then(({ createClient }) => createClient({ cwd, ...(configured ? { miseBinPath: configured } : {}) }))
      .catch((error: unknown) => {
        clients.delete(key);
        throw new Error(`The variant library could not be loaded: ${messageOf(error)}`);
      });
    clients.set(key, loading);
    return loading;
  };
};

/** The records of the library as a source for a webview: the client loads on subscribe, and a failure is delivered. */
export const recordSource = (loadClient: LoadClient) => ({
  subscribe: (listener: (update: { records: VariantRecord[]; error?: string }) => void): (() => void) => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    loadClient().then(
      (client) => {
        if (!cancelled) {
          stop = client.subscribe(listener);
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          listener({ records: [], error: messageOf(error) });
        }
      },
    );
    return () => {
      cancelled = true;
      stop?.();
    };
  },
});
