import { existsSync, lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { primaryWorktree } from "variant-api";

/**
 * Specification: openspec/specs/variant-vscode/onboarding/spec.md
 */

export type OnboardingDirectory = { kind: "directory"; path: string } | { kind: "choice"; paths: string[] };

/** The directory onboarding initializes, or the checkouts a person must choose between. */
export const resolveOnboardingDirectory = (workspace: string): OnboardingDirectory => {
  const root = realpathOrResolve(workspace);
  const entry = gitEntry(root);
  if (entry === "directory") {
    return { kind: "directory", path: root };
  }
  if (entry === "file") {
    const primary = primaryOf(root);
    if (primary !== undefined) {
      return { kind: "directory", path: primary };
    }
  }
  const linked = agentsCheckout(root);
  const children = childCheckouts(root);
  const families = groupByPrimary(children);
  const worktreePrimary = soleWorktreePrimary(families);
  if (linked !== undefined && worktreePrimary !== undefined && linked !== worktreePrimary) {
    return { kind: "choice", paths: [linked, worktreePrimary] };
  }
  if (linked !== undefined) {
    return { kind: "directory", path: linked };
  }
  if (families.size === 1) {
    const primary = [...families.keys()][0];
    if (primary !== undefined) {
      return { kind: "directory", path: primary };
    }
  }
  if (children.length > 1) {
    return { kind: "choice", paths: children };
  }
  if (children.length === 1) {
    return { kind: "directory", path: children[0] };
  }
  return { kind: "directory", path: root };
};

/** The directory of a real `AGENTS.md` reached by a symlink, when that directory contains `.git`. */
const agentsCheckout = (workspace: string): string | undefined => {
  const agents = join(workspace, "AGENTS.md");
  try {
    if (!lstatSync(agents).isSymbolicLink()) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  let checkout: string;
  try {
    checkout = dirname(realpathSync(agents));
  } catch {
    return undefined;
  }
  if (!existsSync(join(checkout, ".git"))) {
    return undefined;
  }
  return realpathOrResolve(checkout);
};

const childCheckouts = (workspace: string): string[] => {
  let names: string[];
  try {
    names = readdirSync(workspace);
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const name of names) {
    const path = join(workspace, name);
    try {
      if (statSync(path).isDirectory() && existsSync(join(path, ".git"))) {
        found.push(realpathOrResolve(path));
      }
    } catch {
      // A child that cannot be stated is not a checkout.
    }
  }
  return found;
};

const groupByPrimary = (directories: readonly string[]): Map<string, string[]> => {
  const families = new Map<string, string[]>();
  for (const directory of directories) {
    const primary = primaryOf(directory);
    if (primary === undefined) {
      continue;
    }
    const group = families.get(primary) ?? [];
    group.push(directory);
    families.set(primary, group);
  }
  return families;
};

/** The primary checkout when exactly one family has more than one worktree. */
const soleWorktreePrimary = (families: ReadonlyMap<string, readonly string[]>): string | undefined => {
  const primaries = [...families.entries()].filter(([, group]) => group.length > 1).map(([primary]) => primary);
  return primaries.length === 1 ? primaries[0] : undefined;
};

const gitEntry = (directory: string): "directory" | "file" | "none" => {
  try {
    return lstatSync(join(directory, ".git")).isDirectory() ? "directory" : "file";
  } catch {
    return "none";
  }
};

const primaryOf = (directory: string): string | undefined => {
  try {
    return realpathOrResolve(primaryWorktree(directory));
  } catch {
    return undefined;
  }
};

const realpathOrResolve = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};
