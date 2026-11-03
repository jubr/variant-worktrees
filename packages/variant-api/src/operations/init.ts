import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEFAULT_PREFIX, findConfigFile, renderInitConfig, resolveMiseBinary } from "variant-config";
import { miseEnvironment, readVariableSources } from "../mise.js";
import { augmentMiseConfig } from "../mise-augment.js";
import type { InitOptions, InitResult } from "../types.js";

/**
 * Specification: openspec/specs/variant-api/init/spec.md
 *
 * Bootstraps a directory for Variant. Everything is checked before anything is written, so a refusal changes nothing.
 */

export interface InitContext {
  cwd: string;
  /** The Mise executable the caller was given. */
  miseBinPath?: string;
}

const validatePrefix = (prefix: string): void => {
  if (prefix === "" || /[\\/]/.test(prefix)) {
    throw new Error(`Invalid prefix ${JSON.stringify(prefix)}: it must not be empty or contain a path separator`);
  }
};

const gitignoreStep = (directory: string, prefix: string): InitResult["gitignore"] => {
  const file = join(directory, ".gitignore");
  const line = `${prefix}*`;
  if (!existsSync(file)) {
    writeFileSync(file, `${line}\n`);
    return { status: "created", changed: true, file, message: `created .gitignore with ${line}` };
  }
  const content = readFileSync(file, "utf8");
  if (content.split(/\r?\n/).includes(line)) {
    return { status: "unchanged", changed: false, file, message: `.gitignore already holds ${line}` };
  }
  writeFileSync(file, `${content}${content === "" || content.endsWith("\n") ? "" : "\n"}${line}\n`);
  return { status: "appended", changed: true, file, message: `added ${line} to .gitignore` };
};

/** Where each variable comes from; empty without Mise or when Mise cannot say. */
const sourcesOf = (directory: string, binary: string | undefined): Record<string, string> => {
  try {
    return readVariableSources({ directory, binary });
  } catch {
    return {};
  }
};

const skipped = { changed: false, file: null, message: "skipped" } as const;

export const initProject = (context: InitContext, options: InitOptions = {}): InitResult => {
  const directory = resolve(context.cwd);
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  validatePrefix(prefix);
  const wantFile = options.file !== false;

  if (wantFile && options.force !== true) {
    const existing = findConfigFile(directory);
    if (existing !== undefined) {
      throw new Error(`${existing} already exists; use force to replace the variants.yaml of this directory`);
    }
  }

  let file: string | null = null;
  let detected: InitResult["detected"] = null;
  if (wantFile) {
    const binary = resolveMiseBinary({ configured: context.miseBinPath });
    const environment = miseEnvironment({ directory, binary });
    const rendered = renderInitConfig(directory, {
      prefix,
      environment,
      sources: sourcesOf(directory, binary),
    });
    file = join(directory, "variants.yaml");
    writeFileSync(file, rendered.text);
    detected = rendered.detected;
  }

  const gitignore: InitResult["gitignore"] =
    options.gitignore === false ? { status: "skipped", ...skipped } : gitignoreStep(directory, prefix);

  let mise: InitResult["mise"] = { status: "skipped", ...skipped };
  if (options.mise !== false) {
    const result = augmentMiseConfig({ directory, miseBinPath: context.miseBinPath });
    mise = {
      status: result.status,
      changed: result.status === "created" || result.status === "added",
      file: result.file ?? null,
      message: result.message,
    };
  }

  return { directory, prefix, file, gitignore, mise, detected };
};
