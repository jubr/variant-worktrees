import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { VariantState } from "./types.js";

const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const assertSlug = (slug: string): void => {
  if (!validSlug.test(slug)) {
    throw new Error(`Invalid variant slug: ${slug}`);
  }
};

export const statePath = (stateDir: string, slug: string): string => {
  assertSlug(slug);
  return join(stateDir, `${slug}.yaml`);
};

export const migrateJsonStates = (stateDir: string): void => {
  if (!existsSync(stateDir)) {
    return;
  }
  for (const filename of readdirSync(stateDir)) {
    if (!filename.endsWith(".json")) {
      continue;
    }
    const jsonPath = join(stateDir, filename);
    const yamlPath = join(stateDir, `${filename.slice(0, -5)}.yaml`);
    if (existsSync(yamlPath)) {
      rmSync(jsonPath);
      continue;
    }
    const value: unknown = JSON.parse(readFileSync(jsonPath, "utf8"));
    writeFileSync(yamlPath, stringify(value), "utf8");
    rmSync(jsonPath);
  }
};

export const readState = (stateDir: string, slug: string): VariantState | undefined => {
  const path = statePath(stateDir, slug);
  if (!existsSync(path)) {
    return undefined;
  }
  const value = parse(readFileSync(path, "utf8")) as VariantState;
  return value;
};

export const writeState = (stateDir: string, state: VariantState): string => {
  const path = statePath(stateDir, state.slug);
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(path, stringify(state), "utf8");
  return path;
};

export const removeState = (stateDir: string, slug: string): void => {
  const path = statePath(stateDir, slug);
  rmSync(path, { force: true });
};

export const stateSlugs = (stateDir: string): string[] => {
  if (!existsSync(stateDir)) {
    return [];
  }
  return readdirSync(stateDir)
    .filter((filename) => filename.endsWith(".yaml"))
    .map((filename) => filename.slice(0, -5))
    .filter((slug) => validSlug.test(slug))
    .sort();
};
