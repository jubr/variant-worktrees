import { dirname, join } from "node:path";

/** Cursor's state database, beside an extension's globalStorage directory. */
export const cursorStateDbPath = (globalStorageFsPath: string): string =>
  join(dirname(globalStorageFsPath), "state.vscdb");
