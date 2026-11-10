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
  /** Local time this watch started, `YYYY-MM-DD_HH:MM:SS`. */
  startedAt?: string;
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
  /** The log file of an attached or detached watch. */
  log?: string;
  /** Local time the variant was created, `YYYY-MM-DD_HH:MM:SS`. */
  createdAt?: string;
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
  /** The absolute path of the log file of its watch. */
  log?: string;
  /** All meta information of the runtime state; set by `status` and by `list` with `verbose`. */
  runtime?: RuntimeStatus;
  /** Epoch milliseconds of `runtime.createdAt` read as local time, or the directory creation time when that stamp is missing or ill-formed. */
  createdMs?: number;
  /** Later modification time, in epoch milliseconds, of the variant directory and its `variants.local.yaml`. */
  changedMs?: number;
  /** Whether `implode` of this slug without `force` would succeed. Always false for `main`. */
  implodeClean: boolean;
  /** Sorted schema names of a variant that has `db.multi`. Absent without it. */
  schemas?: string[];
  /** The database names this variant and no worktree directory exists. */
  dbOnly?: boolean;
}

export interface VariantClientOptions {
  config?: ResolvedConfig;
  configPath?: string;
  /** The Mise executable the caller was given (the editor setting `variant.mise.binPath`); see `loadVariantConfig`. */
  miseBinPath?: string;
  cwd?: string;
  stateDir?: string;
  worktree?: boolean;
  /** Clock for `runtime.createdAt` and watch `startedAt`. Defaults to the current time. */
  now?: () => Date;
  /** Timing of `subscribe`; the defaults are 200 ms and 5 s. */
  subscription?: {
    /** Changes that follow each other within this time produce one delivery. */
    debounceMs?: number;
    /** How often records are read although no file changed, to notice a process that ended. */
    livenessIntervalMs?: number;
    /** Delay before the next read while the database cannot be contacted. Defaults to exponential backoff capped at 1 minute. */
    contactRetryMs?: (attempt: number) => number;
  };
}

/** What a subscriber receives: the current records, and the reason the last read failed, when it did. */
/** A read that failed because Mise did: where, what Mise said, and whether `mise trust` fixes it. */
export interface MiseFailure {
  directory: string;
  detail: string;
  untrusted: boolean;
}

export interface VariantUpdate {
  /** The records `list` returns; after a failed read, those of the last successful read. */
  records: VariantRecord[];
  error?: string;
  /** Set with `error` when the read failed because of Mise. */
  mise?: MiseFailure;
  /** The database contact warning. The records are the partial list, and `error` is unset. */
  warning?: string;
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
  /** Drop the schemas and create them again before the watches start. */
  reprovision?: boolean;
  /** Ends an attached watch as an interrupt (exit code 130), like SIGINT. */
  signal?: AbortSignal;
}

/** What `deprovision` dropped or ran. */
export interface DeprovisionResult {
  slug: string;
  commands: string[];
  output: string;
  /** Schema names the builtin drop removed. Empty when a script replaced the drop, or the step was skipped. */
  dropped: string[];
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
  /** Remove the local branch after the worktree. Omitted means yes. */
  branchRm?: "yes" | "no";
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
  /** The local branch of the variant, when one was found. */
  branch?: string;
  /** Whether that local branch was deleted. */
  branchRemoved: boolean;
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
  /** Skip the list trace, debug, and info lines. A subscription uses this after the first read. */
  quiet?: boolean;
}

/** What `init` does; every step is on unless turned off. */
export interface InitOptions {
  /** The worktree directory prefix; `_v-` by default. */
  prefix?: string;
  /** Write `variants.yaml`; default true. */
  file?: boolean;
  /** Add `<prefix>*` to `.gitignore`; default true. */
  gitignore?: boolean;
  /** Add the CLI to the Mise configuration; default true. */
  mise?: boolean;
  /** Replace the `variants.yaml` of the directory when one exists. */
  force?: boolean;
}

/** What `init` did, step by step. */
export interface InitResult {
  directory: string;
  prefix: string;
  /** The written `variants.yaml`, or null when the step was off. */
  file: string | null;
  gitignore: {
    status: "created" | "appended" | "unchanged" | "skipped";
    changed: boolean;
    file: string | null;
    message: string;
  };
  mise: {
    status: "created" | "added" | "unchanged" | "failed" | "skipped";
    changed: boolean;
    file: string | null;
    message: string;
  };
  /** What autodetection found and the file holds, without any secret; null when the file step was off. */
  detected: {
    dialect: "postgres" | "mysql" | "sqlite";
    databaseSource: "env" | "default";
    abbr: string;
    prefix: string;
    watches: string[];
  } | null;
}

export interface VariantClient {
  /** Bootstraps the directory: `variants.yaml` from autodetection, the `.gitignore` line and the Mise entry. */
  init(options?: InitOptions): Promise<InitResult>;
  create(
    slug?: string,
    options?: { from?: string; pullFf?: boolean; miseInstall?: "bg" | "sync" | "no" },
  ): Promise<VariantRecord>;
  implode(slug?: string, options?: ImplodeOptions): Promise<ImplodeResult>;
  up(slug?: string, options?: UpOptions & { from?: string; pullFf?: boolean }): Promise<UpResult>;
  watch(
    slug?: string,
    options?: WatchOptions & { from?: string; pullFf?: boolean; miseInstall?: "bg" | "sync" | "no" },
  ): Promise<WatchResult>;
  down(slug?: string, options?: DownOptions): Promise<DownResult>;
  /** Stops the watches, then drops the schemas. A `deprovision` script replaces the drop. */
  deprovision(slug?: string, options?: UpOptions): Promise<DeprovisionResult>;
  /** One variant: its record with all runtime meta information. Fails when the slug is unknown. */
  status(slug?: string): Promise<VariantRecord>;
  list(options?: ListOptions): Promise<VariantRecord[]>;
  provision(
    slug?: string,
    options?: {
      from?: string;
      pullFf?: boolean;
      verbose?: boolean;
      log?: (line: string) => void;
      miseInstall?: "bg" | "sync" | "no";
    },
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
  /** Creates one named schema. PostgreSQL only; `db.multi` uses it for each tenant. */
  createSchema(name: string): Promise<void>;
  /** Schema names that start with `prefix`. The match is literal, including `_`. */
  matchingSchemas(prefix: string): Promise<string[]>;
  /** Drops one named schema. PostgreSQL only. */
  dropSchema(name: string): Promise<void>;
  destroy(slug: string): Promise<boolean>;
  list(): Promise<string[]>;
  target(slug: string): string;
  close(): Promise<void>;
  /** Resolves when the server accepts a connection. Absent for SQLite, whose inventory is files. */
  assertReachable?(): Promise<void>;
  /** Drops contact logs for a retry. The failure still throws. */
  silenceContact?(): void;
}
