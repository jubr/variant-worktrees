import { existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { readPrefix } from "./index.js";

const ancestorDirectories = (startDir: string): string[] => {
  const directories: string[] = [];
  let current = resolve(startDir);
  while (!directories.includes(current)) {
    directories.push(current);
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return directories;
};

const isSymlink = (path: string): boolean => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

const isRealFile = (path: string): boolean => {
  try {
    const stat = lstatSync(path);
    return stat.isFile();
  } catch {
    return false;
  }
};

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const childSegment = (root: string, start: string): string | undefined => {
  const relativePath = relative(root, start);
  if (relativePath === "" || relativePath.startsWith("..")) {
    return undefined;
  }
  return relativePath.split(sep)[0];
};

/**
 * Specification: openspec/specs/variant-config/spec.md
 */
export const resolveMainVscodeDir = (startDir: string): string => {
  const start = resolve(startDir);
  const directories = ancestorDirectories(start);
  const prefix = readPrefix(start);

  for (const directory of directories) {
    const agents = join(directory, "AGENTS.md");
    if (isSymlink(agents)) {
      return join(dirname(realpathSync(agents)), ".vscode");
    }
  }

  for (const directory of directories) {
    if (!isRealFile(join(directory, "AGENTS.md")) || basename(directory).startsWith(prefix)) {
      continue;
    }
    const segment = childSegment(directory, start);
    if (directory === start || segment?.startsWith(prefix)) {
      return join(directory, ".vscode");
    }
  }

  for (const directory of directories) {
    if (basename(directory).startsWith(prefix)) {
      continue;
    }
    const vscodeDir = join(directory, ".vscode");
    if (isDirectory(vscodeDir) && existsSync(join(vscodeDir, "settings.json"))) {
      return vscodeDir;
    }
  }

  return join(start, ".vscode");
};
