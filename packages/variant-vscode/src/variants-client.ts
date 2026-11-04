import type { VariantClient, VariantRecord } from "variant-api";

/** What the view, the panel and the onboarding dialog need of the library: the state subscription, the three actions and `init`. */
export type ViewClient = Pick<VariantClient, "subscribe" | "watch" | "down" | "implode" | "init">;

export type LoadClient = () => Promise<ViewClient>;

/** The message of anything thrown, for a notification or a row. */
export const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The library for the project at `cwd`, loaded on first use.
 *
 * AIDEV-NOTE: variant-api is imported lazily. Where its sqlite module is missing (an editor host older than the one
 * `engines.vscode` asks for, or a remote host), the import fails here and the view shows why, instead of the whole
 * extension failing to activate. A failed load is not remembered, so the next use tries again.
 */
export const loadVariantClient = (cwd: string, miseBinPath: () => string | undefined = () => undefined): LoadClient => {
  let loading: Promise<ViewClient> | undefined;
  let loadedWith: string | undefined;
  return () => {
    // The setting `variant.mise.binPath` applies to the next call: a client made with another value is made anew.
    const configured = miseBinPath();
    if (loading !== undefined && configured !== loadedWith) {
      loading = undefined;
    }
    loadedWith = configured;
    loading ??= import("variant-api")
      .then(({ createClient }) => createClient({ cwd, ...(configured ? { miseBinPath: configured } : {}) }))
      .catch((error: unknown) => {
        loading = undefined;
        throw new Error(`The variant library could not be loaded: ${messageOf(error)}`);
      });
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
