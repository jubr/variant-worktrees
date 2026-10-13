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

export interface VariantClient {
  create(slug?: string): Promise<VariantRecord>;
  destroy(slug?: string): Promise<{ slug: string; removed: boolean }>;
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
