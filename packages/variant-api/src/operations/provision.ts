import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { runtimeCommandFor, seedCommandFor } from "variant-config";
import { resolveSlug } from "../slug.js";
import { ensureWorktree } from "../worktree.js";
import type { OperationContext } from "./types.js";

const run = (command: string, cwd: string, env: NodeJS.ProcessEnv): string => {
  try {
    return execFileSync("sh", ["-c", command], {
      cwd,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    const output = `${failure.stdout ?? ""}${failure.stderr ?? ""}`.trim();
    throw new Error(`Command failed (${failure.status ?? 1}): ${command}\n${output}`);
  }
};

export const provisionVariant = async (
  context: OperationContext,
  requestedSlug?: string,
): Promise<{ slug: string; commands: string[]; output: string }> => {
  const slug = resolveSlug(requestedSlug, context.cwd, context.config.variant.branchPrefixes);
  const worktree =
    context.useWorktree && slug !== "main"
      ? ensureWorktree(slug, context.cwd, context.variantRoot, context.config.variant.prefix, context.config.variant)
      : context.cwd;
  const target = slug === "main" ? (context.config.db.schema ?? "public") : context.adapter.target(slug);
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    VARIANT_SLUG: slug,
    VARIANT_TARGET: target,
    VARIANT_CONFIG: context.config.configPath,
  };
  if (context.adapter.dialect === "postgres") {
    environment.POSTGRES_SCHEMA = target;
  }
  if (context.adapter.dialect === "sqlite") {
    environment.SQLITE_DATABASE = target;
  }

  const instanceSteps = Object.values(context.config.variant.instances).flatMap((instance) => {
    const command = runtimeCommandFor(context.config, "up", instance);
    return command ? [{ command, cwd: resolve(worktree, instance.dir) }] : [];
  });
  const upSteps =
    instanceSteps.length > 0 ? instanceSteps : [{ command: runtimeCommandFor(context.config, "up"), cwd: worktree }];
  const steps = [...upSteps, { command: seedCommandFor(context.config, slug), cwd: worktree }].flatMap((step) =>
    step.command ? [{ command: step.command, cwd: step.cwd }] : [],
  );
  const commands = steps.map((step) => step.command);
  const output = steps.map((step) => run(step.command, step.cwd, environment)).join("");
  return { slug, commands, output };
};
