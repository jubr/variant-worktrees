import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

/** Specification: openspec/specs/variant-vscode/variants-tree/spec.md */
const canonical = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

const contains = (directory: string, file: string): boolean => {
  const rel = relative(canonical(directory), canonical(file));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

export const activeVariant = (
  file: string,
  directories: readonly { slug: string; directory: string }[],
): string | undefined =>
  directories
    .filter((row) => row.directory !== "" && contains(row.directory, file))
    .sort((left, right) => canonical(right.directory).length - canonical(left.directory).length)[0]?.slug;
