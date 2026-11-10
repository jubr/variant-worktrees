import { realpathSync } from "node:fs";
import os from "node:os";
import { LogLevel } from "variant-log";

/** Known temporary directories. A match forces the emitted level to trace. */
const KNOWN_TEMPORARY_DIRECTORIES = ["/tmp", "/private/tmp", "/var/folders/", "/var/tmp", os.tmpdir()];

const resolved = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

const under = (directory: string, root: string): boolean => {
  const dir = directory.length > 1 && directory.endsWith("/") ? directory.slice(0, -1) : directory;
  const base = root.length > 1 && root.endsWith("/") ? root.slice(0, -1) : root;
  return dir === base || dir.startsWith(`${base}/`);
};

/** Trace when `directory` is a known temporary directory or a child of one, including through a symlink. */
export const levelForDirectory = (level: LogLevel, directory: string): LogLevel => {
  const given = directory;
  const real = resolved(directory);
  for (const root of KNOWN_TEMPORARY_DIRECTORIES) {
    const roots = [root, resolved(root)];
    if (roots.some((entry) => under(given, entry) || under(real, entry))) {
      return LogLevel.trace;
    }
  }
  return level;
};
