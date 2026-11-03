import { z } from "zod/v4";

/**
 * Specification: openspec/specs/variant-config/core/spec.md (variants.yaml schema)
 */

export interface ParsedConfig<T> {
  data: T;
  /** One `<file>: unknown key <path>` per key the schema does not define; those keys are not in `data`. */
  warnings: string[];
}

type UnrecognizedKeysIssue = z.core.$ZodIssueUnrecognizedKeys;

const isUnrecognized = (issue: z.core.$ZodIssue): issue is UnrecognizedKeysIssue => issue.code === "unrecognized_keys";

const keyPath = (path: readonly PropertyKey[], key: string): string => [...path, key].map(String).join(".");

const container = (root: unknown, path: readonly PropertyKey[]): Record<PropertyKey, unknown> | undefined => {
  let current: unknown = root;
  for (const segment of path) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<PropertyKey, unknown>)[segment];
  }
  return typeof current === "object" && current !== null ? (current as Record<PropertyKey, unknown>) : undefined;
};

const withWarnings = (error: z.ZodError, warnings: readonly string[]): z.ZodError => {
  if (warnings.length === 0) {
    return error;
  }
  const merged = new z.ZodError(error.issues);
  Object.defineProperty(merged, "message", { value: `${error.message}\n${warnings.join("\n")}` });
  return merged;
};

/**
 * Parses `data` with a strict schema and turns the one tolerated violation, a key the schema does not define, into a
 * warning: the key is dropped from a copy of `data` and reported with the file and its path. Any other violation throws
 * the `ZodError`, with the warnings found so far appended to its message. The loop ends because every pass deletes
 * exactly the keys it reported.
 */
export const parseConfig = <S extends z.ZodType>(schema: S, data: unknown, file: string): ParsedConfig<z.output<S>> => {
  const working = structuredClone(data);
  const warnings: string[] = [];
  for (;;) {
    const result = schema.safeParse(working);
    if (result.success) {
      return { data: result.data, warnings };
    }
    const unknownKeys = result.error.issues.filter(isUnrecognized);
    for (const issue of unknownKeys) {
      for (const key of issue.keys) {
        warnings.push(`${file}: unknown key ${keyPath(issue.path, key)}`);
      }
    }
    if (unknownKeys.length !== result.error.issues.length) {
      throw withWarnings(result.error, warnings);
    }
    let deleted = 0;
    for (const issue of unknownKeys) {
      const target = container(working, issue.path);
      for (const key of issue.keys) {
        if (target && key in target) {
          delete target[key];
          deleted += 1;
        }
      }
    }
    if (deleted === 0) {
      throw withWarnings(result.error, warnings);
    }
  }
};
