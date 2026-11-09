import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { newestSessionAgeMs, projectSessionsDir, projectSlug, sessionFilesActive } from "./session-activity";

describe("project sessions", () => {
  it("slugs a workspace path the way Cursor names the project directory", () => {
    expect(projectSlug("/Users/1000060011/jb/priv/vw")).toBe("Users-1000060011-jb-priv-vw");
    expect(projectSessionsDir("/Users/me/proj", "/home/me")).toBe(
      "/home/me/.cursor/projects/Users-me-proj/agent-transcripts",
    );
  });

  it("treats a recent session file as activity and an old one as idle", () => {
    const root = mkdtempSync(join(tmpdir(), "sessions-"));
    const session = join(root, "chat-1");
    mkdirSync(session);
    const file = join(session, "chat-1.jsonl");
    writeFileSync(file, "{}\n");
    const now = Date.now();
    utimesSync(file, now / 1000, (now - 1000) / 1000);

    expect(newestSessionAgeMs(root, now)).toBeGreaterThanOrEqual(500);
    expect(newestSessionAgeMs(root, now)).toBeLessThan(5_000);
    expect(sessionFilesActive(root, now)).toBe(true);

    utimesSync(file, now / 1000, (now - 120_000) / 1000);
    expect(sessionFilesActive(root, now)).toBe(false);
    expect(sessionFilesActive("/no/such/sessions", now)).toBe(false);
  });
});
