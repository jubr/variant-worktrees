import { resolve } from "node:path";
import { groupDatabaseSchemas } from "variant-config";
import { echoCommand, type ProgressLog } from "../echo.js";
import { checkoutRoot, locateWorktree, repositoryDirectory } from "../locate.js";
import { execute } from "../provisioning.js";
import { logToStderr } from "../ready.js";
import { commandEnvironment, expandSetting, prepareRun, type VariantRun } from "../run-context.js";
import { resolveSlug } from "../slug.js";
import type { DeprovisionResult, UpOptions } from "../types.js";
import { downVariant } from "./down.js";
import type { OperationContext } from "./types.js";

const builtinCommand = /^\$\{builtin\.step\.[A-Za-z0-9_-]+\}$/;

export interface DeprovisionPhase {
  commands: string[];
  output: string;
  dropped: string[];
}

/**
 * The deprovision phase alone: a `deprovision` command runs once and replaces the builtin drop.
 * With no such command, the builtin drops the target, every schema under the expanded prefix, and every
 * `v_<slug>-<tenant>` schema grouped under that slug. It does not run `tenantsCmd` and it does not drop roles. `VARIANT_STEP_DEPROVISION=no` skips both.
 */
export const deprovisionPhase = async (
  context: OperationContext,
  run: VariantRun,
  log: ProgressLog = logToStderr,
): Promise<DeprovisionPhase> => {
  const step = context.config.variant.steps.deprovision;
  if (process.env.VARIANT_STEP_DEPROVISION === "no") {
    return {
      commands: [],
      output: "Skipping step deprovision: VARIANT_STEP_DEPROVISION=no\n",
      dropped: [],
    };
  }
  if (step && !builtinCommand.test(step.cmd)) {
    const command = expandSetting(context.config, run, step.cmd, "variant.steps.deprovision.cmd");
    echoCommand(command, log);
    const result = execute(
      command,
      resolve(run.projectDir, step.dir ?? "."),
      commandEnvironment(context.config, run, step.env),
    );
    if (!result.ok) {
      throw new Error(`Step deprovision failed (${result.status}): ${command}\n${result.output}`);
    }
    return { commands: [command], output: result.output, dropped: [] };
  }
  if (run.slug === "main") {
    return { commands: [], output: "", dropped: [] };
  }
  const grouped = groupDatabaseSchemas(await context.adapter.list())
    .filter((group) => group.slug === run.slug)
    .flatMap((group) => group.schemas);
  if (run.multi) {
    const names = [...new Set([...(await context.adapter.matchingSchemas(run.multi.prefix)), ...grouped])].sort();
    for (const name of names) {
      await context.adapter.dropSchema(name);
    }
    return { commands: [], output: "", dropped: names };
  }
  for (const name of grouped) {
    await context.adapter.dropSchema(name);
  }
  const removed = await context.adapter.destroy(run.slug);
  return { commands: [], output: "", dropped: removed ? [...grouped, run.target] : grouped };
};

/** Stops the watches, then runs the deprovision phase. `main` is refused. */
export const deprovisionVariant = async (
  context: OperationContext,
  requestedSlug?: string,
  options: UpOptions = {},
): Promise<DeprovisionResult> => {
  const slug = resolveSlug(requestedSlug, context.cwd, context.config.variant.branchPrefixes, context.config.variant);
  if (slug === "main") {
    throw new Error("Refusing to deprovision main: it is the primary checkout");
  }
  const log = options.log ?? logToStderr;
  await downVariant(context, slug, { log });
  const worktree = locateWorktree(context, slug) ?? checkoutRoot(repositoryDirectory(context));
  const run = await prepareRun(context, slug, worktree);
  const phase = await deprovisionPhase(context, run, log);
  return { slug, ...phase };
};
