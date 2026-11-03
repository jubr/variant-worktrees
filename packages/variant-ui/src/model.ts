/** What the app knows about the watch of a running variant; a subset of the records `variant list` returns. */
export interface WatchFacts {
  port?: number;
  pid?: number;
  url?: string;
  alive?: boolean;
  uptimeSeconds?: number;
}

/** One variant as the app needs it: the fields of a `list` record that the rows show or decide on. */
export interface Variant {
  slug: string;
  mode?: "up" | "watch";
  url?: string;
  watches?: Record<string, WatchFacts>;
  uptimeSeconds?: number;
  log?: string;
  /** Earlier birth time of the variant directory and its `variants.local.yaml`. */
  createdMs?: number;
  /** Later modification time of the variant directory and its `variants.local.yaml`. */
  changedMs?: number;
  /** Whether implode without force would succeed. Absent means the host did not say. */
  implodeClean?: boolean;
}
