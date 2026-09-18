import { execFileSync } from "node:child_process";
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
  const slug = resolveSlug(requestedSlug, context.cwd);
  const worktree =
    context.useWorktree && slug !== "main" ? ensureWorktree(slug, context.cwd, context.variantRoot) : context.cwd;
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

  const instanceCommands = (context.config.variant?.instances ?? [])
    .map((instance) => runtimeCommandFor(context.config, "up", instance))
    .filter((command): command is string => Boolean(command));
  const commands = [
    ...(instanceCommands.length > 0 ? instanceCommands : [runtimeCommandFor(context.config, "up")]),
    seedCommandFor(context.config, slug),
  ].filter((command): command is string => Boolean(command));
  const output = commands.map((command) => run(command, worktree, environment)).join("");
  return { slug, commands, output };
};
