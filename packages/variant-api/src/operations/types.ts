import type { ResolvedConfig } from "variant-config";
import type { DatabaseAdapter } from "../types.js";

export interface OperationContext {
  config: ResolvedConfig;
  variantRoot: string;
  stateDir: string;
  cwd: string;
  useWorktree: boolean;
  adapter: DatabaseAdapter;
  /** The Mise executable the caller was given. Wins over `variant.mise.binPath`. */
  miseBinPath?: string;
  /** Clock for `runtime.createdAt` and `runtime.watches.*.startedAt`. Defaults to the current time. */
  now?: () => Date;
  /** Set when the catalog could not be read because the database is unreachable. */
  contactWarning?: string;
}
