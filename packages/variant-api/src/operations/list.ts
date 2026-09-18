import { readState, stateSlugs } from "../state.js";
import type { VariantRecord } from "../types.js";
import type { OperationContext } from "./types.js";

const slugFromTarget = (target: string, dialect: string): string => {
  if (dialect === "sqlite") {
    return target;
  }
  return target.replace(/^v_/, "").replaceAll("_", "-");
};

export const listVariants = async (context: OperationContext): Promise<VariantRecord[]> => {
  const targets = await context.adapter.list();
  const slugs = new Set([
    ...stateSlugs(context.stateDir),
    ...targets.map((target) => slugFromTarget(target, context.adapter.dialect)),
  ]);
  return [...slugs].sort().map((slug) => {
    const state = readState(context.stateDir, slug);
    const target =
      state?.target ?? targets.find((value) => slugFromTarget(value, context.adapter.dialect) === slug) ?? "";
    return {
      slug,
      target,
      dialect: state?.dialect ?? context.adapter.dialect,
      statePath: state?.statePath ?? "",
      worktree: state?.worktree,
      createdAt: state?.createdAt ?? "",
      exists: true,
    };
  });
};
