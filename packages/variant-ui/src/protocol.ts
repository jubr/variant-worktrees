import type { Variant } from "./model.js";
import type { ConnectionState, Transport } from "./transport.js";

/**
 * The messages between the app in an editor webview and the extension that hosts it. Both halves live here, so they
 * cannot drift apart: `createWebviewTransport` runs in the webview, `attachWebviewHost` in the extension.
 */
export type ActionName = "watch" | "down" | "implode" | "showOutput";

export interface ActionRequest {
  action: ActionName;
  slug: string;
  confirm?: boolean;
}

/** Webview to extension. */
export type WebviewMessage = { type: "ready" } | ({ type: "action"; id: number } & ActionRequest);

/** Extension to webview. */
export type HostMessage =
  | { type: "snapshot"; records: Variant[]; connection: ConnectionState }
  | { type: "result"; id: number; error?: string };

/** One end of the message channel. `listen` returns the way to stop listening. */
export interface MessagePort<Out, In> {
  post(message: Out): void;
  listen(handler: (message: In) => void): () => void;
}

/** The transport of the editor panel: records and connection state arrive as snapshots, actions as requests. */
export const createWebviewTransport = (port: MessagePort<WebviewMessage, HostMessage>): Transport => {
  let records: readonly Variant[] = [];
  let state: ConnectionState = "connecting";
  let nextId = 1;
  const listeners = new Set<() => void>();
  const pending = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();
  const notify = (): void => {
    for (const listener of [...listeners]) {
      listener();
    }
  };

  port.listen((message) => {
    if (message.type === "snapshot") {
      records = message.records;
      state = message.connection;
      notify();
      return;
    }
    const waiting = pending.get(message.id);
    pending.delete(message.id);
    if (message.error === undefined) {
      waiting?.resolve();
    } else {
      waiting?.reject(new Error(message.error));
    }
  });

  const request = (entry: ActionRequest): Promise<void> =>
    new Promise((resolve, reject) => {
      const id = nextId;
      nextId += 1;
      pending.set(id, { resolve, reject });
      port.post({ type: "action", id, ...entry });
    });

  port.post({ type: "ready" });

  return {
    origin: "editor",
    records: () => records,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    state: () => state,
    watch: (slug) => request({ action: "watch", slug }),
    down: (slug) => request({ action: "down", slug }),
    implode: (slug, confirm) => request({ action: "implode", slug, confirm }),
    showOutput: (slug) => request({ action: "showOutput", slug }),
  };
};

/** What the extension reads records from: the state subscription of the library. */
export interface RecordSource {
  subscribe(listener: (update: { records: Variant[]; error?: string }) => void): () => void;
}

/**
 * The extension's end of a webview. It subscribes to `source` once the webview says it is ready, and again if the
 * webview loads anew; it runs each requested action with `run` and answers with the outcome.
 */
export const attachWebviewHost = (
  port: MessagePort<HostMessage, WebviewMessage>,
  source: RecordSource,
  run: (request: ActionRequest) => Promise<void>,
): { dispose(): void } => {
  let unsubscribe: (() => void) | undefined;
  const subscribe = (): void => {
    unsubscribe?.();
    unsubscribe = source.subscribe((update) =>
      port.post({
        type: "snapshot",
        records: update.records,
        connection: update.error === undefined ? "connected" : "disconnected",
      }),
    );
  };
  const stopListening = port.listen((message) => {
    if (message.type === "ready") {
      subscribe();
      return;
    }
    const { id, type: _type, ...request } = message;
    run(request).then(
      () => port.post({ type: "result", id }),
      (error: unknown) =>
        port.post({ type: "result", id, error: error instanceof Error ? error.message : String(error) }),
    );
  });
  return {
    dispose: () => {
      stopListening();
      unsubscribe?.();
      unsubscribe = undefined;
    },
  };
};
