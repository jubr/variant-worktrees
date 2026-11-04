import { execFileSync } from "node:child_process";
import { parseMultiList, renderTemplate } from "variant-config";
import type { OperationContext } from "./operations/types.js";
import type { VariantRun } from "./run-context.js";

/** The tenant list and the expanded prefix for one operation. The list is read at most once. */
export interface ResolvedMulti {
  /** `schemaPrefix` with `${slug}` filled in. Reading it does not run `tenantsCmd`. */
  prefix: string;
  /** Tenant names. A literal `tenants` runs no command; `tenantsCmd` runs once, on the first call. */
  tenants: () => string[];
  /** `tenants` joined with commas. Shares the one resolution with `tenants`. */
  joined: () => string;
}

/**
 * The `db.multi` of this operation, or nothing when the project has no set.
 * `tenantsCmd` runs with `sh -c` in the project directory and the process environment, after `${worktree}`,
 * `${slug}` and `${schema}` are replaced.
 */
export const resolveMulti = (context: OperationContext, run: VariantRun): ResolvedMulti | undefined => {
  const multi = context.config.db.multi;
  if (multi === undefined) {
    return undefined;
  }
  const values = {
    slug: run.slug,
    schema: run.target,
    worktree: run.worktree,
    variant: true as const,
    env: context.config.environment,
  };
  const prefix = renderTemplate(multi.schemaPrefix, { ...values, setting: "db.multi.schemaPrefix" });
  let cached: string[] | undefined;
  const tenants = (): string[] => {
    if (cached) {
      return cached;
    }
    if (multi.tenants !== undefined) {
      const parsed = parseMultiList(multi.tenants);
      if (parsed.length === 0) {
        throw new Error("db.multi.tenants printed no value");
      }
      cached = parsed;
      return cached;
    }
    const command = renderTemplate(multi.tenantsCmd ?? "", { ...values, setting: "db.multi.tenantsCmd" });
    let output = "";
    try {
      output = execFileSync("sh", ["-c", command], {
        cwd: run.projectDir,
        env: process.env,
        encoding: "utf8",
      });
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      const status = failure.status ?? 1;
      const printed = `${failure.stdout ?? ""}${failure.stderr ?? ""}`.trim();
      throw new Error(`db.multi.tenantsCmd failed (${status}): ${command}${printed ? `\n${printed}` : ""}`);
    }
    let parsed: string[];
    try {
      parsed = parseMultiList(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`db.multi.tenantsCmd ${command}: ${message}`);
    }
    if (parsed.length === 0) {
      throw new Error(`db.multi.tenantsCmd ${command} printed no value`);
    }
    cached = parsed;
    return cached;
  };
  return { prefix, tenants, joined: () => tenants().join(",") };
};
