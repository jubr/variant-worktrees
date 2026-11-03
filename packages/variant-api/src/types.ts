import type { ResolvedConfig, ResolvedRuntime } from "variant-config";

export interface VariantState {
  slug: string;
  target: string;
  dialect: string;
  statePath: string;
  worktree?: string;
  createdAt: string;
}

/** What is known about one watch of a running variant. `alive` is set when a pid is recorded. */
export interface WatchFacts {
  port?: number;
  pid?: number;
  url?: string;
  alive?: boolean;
  /** How long the process of the recorded pid has been running; set only when it is alive. */
  uptimeSeconds?: number;
}

/** The runtime state of a variant as `status` reports it: the `runtime` section of its `variants.local.yaml`. */
export interface RuntimeStatus {
  /** The `variants.local.yaml` it was read from. */
  file: string;
  slug?: string;
  mode?: "up" | "watch";
  dir?: string;
  /** The log file of a detached watch. */
  log?: string;
  /** The database settings, with the password redacted. */
  db?: ResolvedRuntime["db"];
  watches?: Record<string, WatchFacts>;
}

export interface VariantRecord extends VariantState {
  exists: boolean;
  /** `up` or `watch`, from the runtime state of the variant. */
  mode?: "up" | "watch";
  /** The URL of the first watch that has one. */
  url?: string;
  watches?: Record<string, WatchFacts>;
  /** The longest time any live recorded process of the variant has been running. */
  uptimeSeconds?: number;
  /** The absolute path of the log file of its detached watch. */
  log?: string;
  /** All meta information of the runtime state; set by `status` and by `list` with `verbose`. */
  runtime?: RuntimeStatus;
  /** Earlier birth time, in epoch milliseconds, of the variant directory and its `variants.local.yaml`. */
  createdMs?: number;
  /** Later modification time, in epoch milliseconds, of the variant directory and its `variants.local.yaml`. */
  changedMs?: number;
  /** Whether `implode` of this slug without `force` would succeed. Always false for `main`. */
  implodeClean: boolean;
}

export interface VariantClientOptions {
  config?: ResolvedConfig;
  configPath?: string;
  cwd?: string;
  stateDir?: string;
  worktree?: boolean;
  /** Timing of `subscribe`; the defaults are 200 ms and 5 s. */
  subscription?: {
    /** Changes that follow each other within this time produce one delivery. */
    debounceMs?: number;
    /** How often records are read although no file changed, to notice a process that ended. */
    livenessIntervalMs?: number;
  };
}

/** What a subscriber receives: the current records, and the reason the last read failed, when it did. */
export interface VariantUpdate {
  /** The records `list` returns; after a failed read, those of the last successful read. */
  records: VariantRecord[];
  error?: string;
}

/** How `down` talks to the person running it. */
export interface DownOptions {
  /** Receives the engine commands that run; the default writes to stderr. */
  log?: (line: string) => void;
}

/** What `down` stopped. */
export interface DownResult {
  slug: string;
  /** Host processes that were terminated, with the watch key they belong to. */
  processes: { key: string; pid: number }[];
  containers: string[];
  networks: string[];
}

/** How `up` and `watch` talk to the person running them. */
export interface UpOptions {
  /** Print the full output of steps that set `show`. */
  verbose?: boolean;
  /** Opens a URL in the browser; the default launches the system browser. */
  opener?: (url: string) => void | Promise<void>;
  /** Receives progress lines; the default writes to stderr. */
  log?: (line: string) => void;
}

export interface WatchOptions extends UpOptions {
  /** Start the processes detached from the console and return without waiting. */
  detach?: boolean;
  /** Ends an attached watch as an interrupt (exit code 130), like SIGINT. */
  signal?: AbortSignal;
}

/** What is known about one watch of a started variant. */
export interface WatchReport {
  /** The assigned port; the variant-wide process has none. */
  port?: number;
  /** The rendered `open` URL, when the watch has a template. */
  url?: string;
  /** The process id of a watch that runs as a host process. */
  pid?: number;
  /** The name of the container of a watch that runs as one. */
  container?: string;
}

/** What `watch` started and how it ended. */
export interface WatchResult {
  slug: string;
  mode: "watch";
  worktree: string;
  /** The database target of the variant. */
  target: string;
  watches: Record<string, WatchReport>;
  /** The host processes that were started, in start order, with the command that runs. */
  processes: { key: string; pid: number; command: string }[];
  urls: Record<string, string>;
  /** 0 for a detached watch, 130 when interrupted, 1 when a watch ended or the worktree disappeared. */
  exitCode: 0 | 1 | 130;
  commands: string[];
  output: string;
}

export interface ImplodeOptions {
  /** Implode even when the work is not merged, and remove a worktree that has local changes. */
  force?: boolean;
  /** Receives the report of what the worktree held; the default writes to stderr. */
  log?: (line: string) => void;
}

/** What `implode` removed. */
export interface ImplodeResult {
  slug: string;
  /** Whether a database target or a state file existed. */
  removed: boolean;
  /** Whether a git worktree was removed; a variant may have none. */
  worktreeRemoved: boolean;
  /** The directory of the removed worktree. */
  worktree?: string;
  /** `git status`, `git diff --stat` and the short diff of the worktree as it was before it was removed. */
  report?: string;
}

/** What `up` started. */
export interface UpResult {
  slug: string;
  mode: "up";
  worktree: string;
  /** The database target of the variant. */
  target: string;
  watches: Record<string, WatchReport>;
  /** The containers that were started, in start order. */
  containers: { key: string; name: string; port: number }[];
  /** The rendered `open` URL of every watch that has one. */
  urls: Record<string, string>;
  commands: string[];
  output: string;
}

/** What `list` returns. */
export interface ListOptions {
  /** Give every record all the meta information `status` returns. */
  verbose?: boolean;
}

export interface VariantClient {
  create(slug?: string): Promise<VariantRecord>;
  implode(slug?: string, options?: ImplodeOptions): Promise<ImplodeResult>;
  up(slug?: string, options?: UpOptions): Promise<UpResult>;
  watch(slug?: string, options?: WatchOptions): Promise<WatchResult>;
  down(slug?: string, options?: DownOptions): Promise<DownResult>;
  /** One variant: its record with all runtime meta information. Fails when the slug is unknown. */
  status(slug?: string): Promise<VariantRecord>;
  list(options?: ListOptions): Promise<VariantRecord[]>;
  provision(
    slug?: string,
    options?: { verbose?: boolean; log?: (line: string) => void },
  ): Promise<{ slug: string; commands: string[]; output: string }>;
  config(): ResolvedConfig;
  /**
   * Delivers the records now and again whenever they change: a state file, a runtime file or a worktree changes, or a
   * recorded process ends. `uptimeSeconds` alone is no change. Returns the function that ends the subscription.
   */
  subscribe(listener: (update: VariantUpdate) => void): () => void;
}

export interface DatabaseAdapter {
  readonly dialect: string;
  create(slug: string): Promise<string>;
  destroy(slug: string): Promise<boolean>;
  list(): Promise<string[]>;
  target(slug: string): string;
  close(): Promise<void>;
}
