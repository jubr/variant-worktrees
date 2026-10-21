import type { ResolvedConfig } from "variant-config";
import type { DatabaseAdapter } from "../types.js";

export interface OperationContext {
  config: ResolvedConfig;
  variantRoot: string;
  stateDir: string;
  cwd: string;
  useWorktree: boolean;
  adapter: DatabaseAdapter;
}
