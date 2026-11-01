/** What the app knows about the instance of a running variant; a subset of the records `variant list` returns. */
export interface InstanceFacts {
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
  instances?: Record<string, InstanceFacts>;
  uptimeSeconds?: number;
  log?: string;
}
