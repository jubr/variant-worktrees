import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { amendDotenv, runtimeCommandFor, seedCommandFor, type VariantInstance } from "variant-config";
import type { OperationContext } from "./operations/types.js";
import { commandEnvironment, expandEnv, type VariantRun } from "./run-context.js";

export interface ProvisionOptions {
  /** Print the full output of steps that set `show`. */
  verbose?: boolean;
}

export interface ProvisionResult {
  /** Every command that ran, in order. */
  commands: string[];
  /** The printed output of the pipeline. */
  output: string;
}

interface Executed {
  ok: boolean;
  status: number;
  output: string;
}

const execute = (command: string, cwd: string, env: NodeJS.ProcessEnv): Executed => {
  try {
    const output = execFileSync("sh", ["-c", command], {
      cwd,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, status: 0, output };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    return { ok: false, status: failure.status ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`.trim() };
  }
};

const lineEnd = (text: string): string => (text === "" || text.endsWith("\n") ? text : `${text}\n`);

/** The source of an instance's dotenv copy: the override, the primary worktree's file, then its `.example`. */
const dotenvSources = (run: VariantRun, instance: VariantInstance, dotenv: string): string[] => {
  const override = process.env.VARIANT_ENV_SOURCE || instance.dotenvSource;
  const inPrimary = join(run.primary, instance.dir, dotenv);
  return [
    ...(override ? [isAbsolute(override) ? override : resolve(run.primary, override)] : []),
    inPrimary,
    `${inPrimary}.example`,
  ];
};

/** Writes or amends the dotenv file of one instance and returns what to print. */
const prepareDotenv = (run: VariantRun, key: string, instance: VariantInstance): string => {
  if (instance.dotenv === undefined) {
    return "";
  }
  const path = join(run.worktree, instance.dir, instance.dotenv);
  const always = expandEnv(instance.envAlways, run, key);
  if (existsSync(path)) {
    const current = readFileSync(path, "utf8");
    const amended = amendDotenv(current, always);
    if (amended !== current) {
      writeFileSync(path, amended);
    }
    return run.isPrimary ? "" : `Skipped copy of ${instance.dir}/${instance.dotenv}: it already exists\n`;
  }
  if (run.isPrimary) {
    return "";
  }
  const source = dotenvSources(run, instance, instance.dotenv).find((candidate) => existsSync(candidate));
  const entries = { ...expandEnv(instance.env, run, key), ...always };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, amendDotenv(source ? readFileSync(source, "utf8") : "", entries));
  return source
    ? `Copied ${instance.dir}/${instance.dotenv} from ${source}\n`
    : `Warning: no source for ${instance.dir}/${instance.dotenv}; wrote only the configured values\n`;
};

/**
 * Prepares a variant for its instances, one pipeline for `provision`, `up` and `watch`: storage directory, instance
 * dependency installs, dotenv copies, the `up` commands, the steps of `variant.steps` and the seed command. The first
 * failure stops the pipeline and names the command.
 */
export const runProvisioning = (
  context: OperationContext,
  run: VariantRun,
  options: ProvisionOptions = {},
): ProvisionResult => {
  const { config } = context;
  const commands: string[] = [];
  let output = "";

  const command = (text: string, cwd: string, env: NodeJS.ProcessEnv, label = text): void => {
    commands.push(text);
    const result = execute(text, cwd, env);
    if (!result.ok) {
      throw new Error(`${label} failed (${result.status}): ${text}\n${result.output}`);
    }
    output += result.output;
  };

  if (run.storage) {
    mkdirSync(run.storage, { recursive: true });
  }
  const instances = Object.entries(config.variant.instances);

  for (const [key, instance] of instances) {
    const dir = resolve(run.worktree, instance.dir);
    if (instance.install && !existsSync(join(dir, "node_modules"))) {
      command(instance.install, dir, commandEnvironment(config, run, instance.env, key), "Install");
    }
  }
  for (const [key, instance] of instances) {
    output += prepareDotenv(run, key, instance);
  }

  const upCommands = instances.flatMap(([key, instance]) => {
    const text = runtimeCommandFor(config, "up", instance);
    return text
      ? [{ text, cwd: resolve(run.worktree, instance.dir), env: commandEnvironment(config, run, instance.env, key) }]
      : [];
  });
  const variantUp = runtimeCommandFor(config, "up");
  const plainEnv = commandEnvironment(config, run, undefined);
  for (const up of upCommands.length > 0
    ? upCommands
    : variantUp
      ? [{ text: variantUp, cwd: run.worktree, env: plainEnv }]
      : []) {
    command(up.text, up.cwd, up.env, "Command");
  }

  for (const step of config.variant.steps ?? []) {
    const skipped = Object.entries(step.unlessEnv ?? {});
    if (skipped.length > 0 && skipped.every(([name, value]) => process.env[name] === value)) {
      output += `Skipping step ${step.name}: ${skipped.map(([name, value]) => `${name}=${value}`).join(", ")}\n`;
      continue;
    }
    commands.push(step.run);
    const result = execute(step.run, resolve(run.worktree, step.dir ?? "."), commandEnvironment(config, run, step.env));
    if (!result.ok) {
      throw new Error(`Step ${step.name} failed (${result.status}): ${step.run}\n${result.output}`);
    }
    if (step.show !== undefined && !options.verbose) {
      const pattern = new RegExp(step.show);
      output += lineEnd(
        result.output
          .split("\n")
          .filter((line) => pattern.test(line))
          .join("\n"),
      );
    } else {
      output += result.output;
    }
  }

  const seed = seedCommandFor(config, run.slug);
  if (seed) {
    command(seed, run.worktree, plainEnv);
  }
  return { commands, output };
};
