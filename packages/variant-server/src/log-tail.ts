import { closeSync, openSync, readSync, statSync } from "node:fs";

export const DEFAULT_TAIL_LINES = 200;
export const MAX_TAIL_LINES = 2000;

/** The `lines` query: a positive integer, at most 2000; anything else is the default of 200. */
export const linesFrom = (value: string | null): number => {
  const lines = value !== null && /^\d+$/.test(value) ? Number(value) : 0;
  return lines < 1 ? DEFAULT_TAIL_LINES : Math.min(lines, MAX_TAIL_LINES);
};

/** How much of the end of a log is read: enough for the most lines of a normal log without reading a huge file whole. */
const WINDOW_BYTES = 4 * 1024 * 1024;

/** The last `lines` lines of the file, or nothing when it cannot be read. */
export const readTail = (path: string, lines: number): string | undefined => {
  try {
    const size = statSync(path).size;
    const length = Math.min(size, WINDOW_BYTES);
    const buffer = Buffer.alloc(length);
    const descriptor = openSync(path, "r");
    try {
      readSync(descriptor, buffer, 0, length, size - length);
    } finally {
      closeSync(descriptor);
    }
    const all = buffer.toString("utf8").split("\n");
    if (all.at(-1) === "") {
      all.pop();
    }
    const kept = size > length ? all.slice(1) : all;
    return `${kept.slice(-lines).join("\n")}\n`;
  } catch {
    return undefined;
  }
};
