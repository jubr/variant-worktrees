import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  amendDotenv,
  envSegment,
  multiSchemaName,
  type ResolvedConfig,
  runtimeCommandFor,
  seedCommandFor,
  type VariantWatch,
} from "variant-config";
import { echoCommand, type ProgressLog } from "./echo.js";
import { log } from "./log.js";
import type { OperationContext } from "./operations/types.js";
import { commandEnvironment, expandEnv, expandSetting, type VariantRun } from "./run-context.js";

export interface ProvisionOptions {
  /** Git commit-ish a newly created variant branch starts at. Omitted, the branch starts at `variant.baseBranch`. */
  from?: string;
  /** Fast-forward that start branch before a new variant branch is created. */
  pullFf?: boolean;
  /** Print the full output of steps that set `filterLinesRegex`. */
  verbose?: boolean;
  /** Receives progress lines, such as the command about to run; the default writes to stderr. */
  log?: ProgressLog;
  /** `watch` only: drop the schemas before the provision phase creates them again. */
  reprovision?: boolean;
}

export interface ProvisionResult {
  /** Every command that ran, in order. */
  commands: string[];
  /** The printed output of the pipeline. */
  output: string;
}

export interface Executed {
  ok: boolean;
  status: number;
  output: string;
}

/** Runs a shell command and captures its output instead of throwing on failure. */
export const execute = (command: string, cwd: string, env: NodeJS.ProcessEnv): Executed => {
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

/** The source of a watch's env file copy: `VARIANT_ENV_SOURCE`, the primary worktree's file, then its `.example`. */
const envFileSources = (run: VariantRun, watch: VariantWatch, sourceFile: string): string[] => {
  const override = process.env.VARIANT_ENV_SOURCE;
  const inPrimary = join(run.primaryProjectDir, watch.dir, sourceFile);
  return [...(override ? [resolve(run.primaryProjectDir, override)] : []), inPrimary, `${inPrimary}.example`];
};

/**
 * Writes the env file of one watch, once: its `overrides` and the storage variable are applied when the copy is
 * created. An existing file and the primary worktree stay as they are. Returns what to print.
 */
const prepareEnvFile = (config: ResolvedConfig, run: VariantRun, key: string, watch: VariantWatch): string => {
  const sourceFile = watch.env?.sourceFile;
  if (sourceFile === undefined || run.isPrimary) {
    return "";
  }
  const path = join(run.projectDir, watch.dir, sourceFile);
  if (existsSync(path)) {
    return `Skipped copy of ${watch.dir}/${sourceFile}: it already exists\n`;
  }
  const source = envFileSources(run, watch, sourceFile).find((candidate) => existsSync(candidate));
  const entries = {
    ...(run.storage && config.variant.storage ? { [config.variant.storage.envVarName]: run.storage } : {}),
    ...expandEnv(config, watch.env?.overrides, run, key, `variant.watches.${key}.env.overrides`),
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, amendDotenv(source ? readFileSync(source, "utf8") : "", entries));
  return source
    ? `Copied ${watch.dir}/${sourceFile} from ${source}\n`
    : `Warning: no source for ${watch.dir}/${sourceFile}; wrote only the configured values\n`;
};

/**
 * Prepares a variant for its watches, one pipeline for `provision`, `up` and `watch`: storage directory, watch
 * dependency installs, env file copies, the `up` commands, the steps of `variant.steps` and the seed command. The first
 * failure stops the pipeline and names the command.
 */
export const runProvisioning = async (
  context: OperationContext,
  run: VariantRun,
  options: ProvisionOptions = {},
): Promise<ProvisionResult> => {
  const { config } = context;
  const commands: string[] = [];
  let output = "";

  const command = (text: string, cwd: string, env: NodeJS.ProcessEnv, label = text): void => {
    commands.push(text);
    echoCommand(text, options.log);
    const result = execute(text, cwd, env);
    if (!result.ok) {
      throw new Error(`${label} failed (${result.status}): ${text}\n${result.output}`);
    }
    output += result.output;
  };

  if (run.storage) {
    mkdirSync(run.storage, { recursive: true });
  }
  const watches = Object.entries(config.variant.watches);

  for (const [key, watch] of watches) {
    const dir = resolve(run.projectDir, watch.dir);
    if (watch.install && !existsSync(join(dir, "node_modules"))) {
      command(
        expandSetting(config, run, watch.install, `variant.watches.${key}.install`, key),
        dir,
        commandEnvironment(config, run, watch.env?.overrides, key),
        "Install",
      );
    }
  }
  for (const [key, watch] of watches) {
    output += prepareEnvFile(config, run, key, watch);
  }

  const upCommands = watches.flatMap(([key, watch]) => {
    const text = runtimeCommandFor("up", watch);
    return text
      ? [
          {
            text: expandSetting(config, run, text, `variant.watches.${key}.up`, key),
            cwd: resolve(run.projectDir, watch.dir),
            env: commandEnvironment(config, run, watch.env?.overrides, key),
          },
        ]
      : [];
  });
  const plainEnv = commandEnvironment(config, run, undefined);
  for (const up of upCommands) {
    command(up.text, up.cwd, up.env, "Command");
  }

  for (const [name, step] of Object.entries(config.variant.steps)) {
    // AIDEV-NOTE: ${builtin.step.<name>} is the builtin implementation, not a shell command.
    if (/^\$\{builtin\.step\.[A-Za-z0-9_-]+\}$/.test(step.cmd)) {
      const skipVariable = `VARIANT_STEP_${envSegment(name)}`;
      if (process.env[skipVariable] === "no") {
        output += `Skipping step ${name}: ${skipVariable}=no\n`;
        continue;
      }
      if (name === "provision" && run.slug !== "main") {
        // AIDEV-NOTE: a provision cmd replaces this. Otherwise one schema per tenant, or the single target.
        if (run.multi) {
          for (const tenant of run.multi.tenants()) {
            const schema = multiSchemaName(run.multi.prefix, run.slug, tenant);
            log("info", `[${run.slug}] [${name}] create schema ${schema}`);
            await context.adapter.createSchema(schema);
          }
        } else {
          log("info", `[${run.slug}] [${name}] create schema ${context.adapter.target(run.slug)}`);
          await context.adapter.create(run.slug);
        }
      }
      continue;
    }
    const skipVariable = `VARIANT_STEP_${envSegment(name)}`;
    if (process.env[skipVariable] === "no") {
      output += `Skipping step ${name}: ${skipVariable}=no\n`;
      continue;
    }
    const stepCommand = expandSetting(config, run, step.cmd, `variant.steps.${name}.cmd`);
    log("info", `[${run.slug}] [${name}] ${stepCommand}`);
    commands.push(stepCommand);
    echoCommand(stepCommand, options.log);
    const result = execute(
      stepCommand,
      resolve(run.projectDir, step.dir ?? "."),
      commandEnvironment(config, run, step.env),
    );
    if (!result.ok) {
      throw new Error(`Step ${name} failed (${result.status}): ${stepCommand}\n${result.output}`);
    }
    if (step.filterLinesRegex !== undefined && !options.verbose) {
      const pattern = new RegExp(step.filterLinesRegex);
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
    const seedCommand = expandSetting(config, run, seed, "seed");
    log("info", `[${run.slug}] [seed] ${seedCommand}`);
    command(seedCommand, run.projectDir, plainEnv);
  }
  return { commands, output };
};
