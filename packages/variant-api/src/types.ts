import type { ResolvedConfig } from "variant-config";

export interface VariantState {
  slug: string;
  target: string;
  dialect: string;
  statePath: string;
  worktree?: string;
  createdAt: string;
}

/** What is known about one instance of a running variant. `alive` is set when a pid is recorded. */
export interface InstanceFacts {
  port?: number;
  pid?: number;
  url?: string;
  alive?: boolean;
}

export interface VariantRecord extends VariantState {
  exists: boolean;
  /** `up` or `watch`, from the runtime state of the variant. */
  mode?: "up" | "watch";
  /** The URL of the first instance that has one. */
  url?: string;
  instances?: Record<string, InstanceFacts>;
}

export interface VariantClientOptions {
  config?: ResolvedConfig;
  configPath?: string;
  cwd?: string;
  stateDir?: string;
  worktree?: boolean;
}

/** What `down` stopped. */
export interface DownResult {
  slug: string;
  /** Host processes that were terminated, with the instance key they belong to. */
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

/** What `watch` started and how it ended. */
export interface WatchResult {
  slug: string;
  worktree: string;
  /** The host processes that were started, in start order, with the command that runs. */
  processes: { key: string; pid: number; command: string }[];
  urls: Record<string, string>;
  /** 0 for a detached watch, 130 when interrupted, 1 when an instance ended or the worktree disappeared. */
  exitCode: 0 | 1 | 130;
  commands: string[];
  output: string;
}

/** What `up` started. */
export interface UpResult {
  slug: string;
  worktree: string;
  /** The containers that were started, in start order. */
  containers: { key: string; name: string; port: number }[];
  /** The rendered `open` URL of every instance that has one. */
  urls: Record<string, string>;
  commands: string[];
  output: string;
}

export interface VariantClient {
  create(slug?: string): Promise<VariantRecord>;
  implode(slug?: string): Promise<{ slug: string; removed: boolean }>;
  up(slug?: string, options?: UpOptions): Promise<UpResult>;
  watch(slug?: string, options?: WatchOptions): Promise<WatchResult>;
  down(slug?: string): Promise<DownResult>;
  list(): Promise<VariantRecord[]>;
  switch(slug?: string): Promise<{ slug: string; worktree: string }>;
  provision(
    slug?: string,
    options?: { verbose?: boolean },
  ): Promise<{ slug: string; commands: string[]; output: string }>;
  config(): ResolvedConfig;
}

export interface DatabaseAdapter {
  readonly dialect: string;
  create(slug: string): Promise<string>;
  destroy(slug: string): Promise<boolean>;
  list(): Promise<string[]>;
  target(slug: string): string;
  close(): Promise<void>;
}
