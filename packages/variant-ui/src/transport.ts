import type { Variant } from "./model.js";
import type { VariantSort } from "./sort.js";

export type ConnectionState = "connected" | "connecting" | "disconnected";

/**
 * Everything the app gets from its host, and the only way it reaches it. An action settles with success, or rejects
 * with an `Error` whose message is shown to the person.
 *
 * AIDEV-NOTE: `origin` says where the page runs. A page served by the UI server (`"server"`) describes that very server
 * in its `variant-ui` row, so it has no stop control there; the editor (`"editor"`) shows it and stops the server with
 * `down("variant-ui")`.
 */
export interface Transport {
  readonly origin: "editor" | "server";
  /** The current set of records. The same array until the set changes. */
  records(): readonly Variant[];
  /** The order the host wants. `name-asc` when it does not choose. */
  sort(): VariantSort;
  /** Calls `listener` after every change of the records, the sort or the connection state. Returns the way to stop. */
  subscribe(listener: () => void): () => void;
  state(): ConnectionState;
  watch(slug: string): Promise<void>;
  down(slug: string): Promise<void>;
  implode(slug: string, confirm: boolean): Promise<void>;
  showOutput(slug: string): Promise<void>;
}
