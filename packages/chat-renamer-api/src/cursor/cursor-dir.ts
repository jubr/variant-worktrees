import { join } from "node:path";

import type { HookScope } from "chat-renamer-config";

/** The `.cursor` folder that holds hooks.json. Workspace scope without an open folder falls back to the user folder. */
export const resolveCursorDir = (scope: HookScope, workspaceRoot: string | undefined, home: string): string =>
  scope === "workspace" && workspaceRoot ? join(workspaceRoot, ".cursor") : join(home, ".cursor");

/** Project hooks run from the project root, so they use a relative command. User hooks use an absolute path. */
export const hookCommand = (cursorDir: string, workspaceRoot: string | undefined, scriptName: string): string =>
  workspaceRoot && cursorDir === join(workspaceRoot, ".cursor")
    ? `.cursor/hooks/${scriptName}`
    : join(cursorDir, "hooks", scriptName);
