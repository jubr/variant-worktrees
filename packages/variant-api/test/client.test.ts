import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";

describe("createClient", () => {
  it("creates a typed lifecycle client from resolved config", () => {
    const directory = mkdtempSync(join("/tmp", "variant-client-"));
    try {
      const config = loadConfig({ cwd: directory });
      const client = createClient({ config, cwd: directory, worktree: false });
      expect(typeof client.create).toBe("function");
      expect(typeof client.implode).toBe("function");
      expect(typeof client.list).toBe("function");
      expect(client.config()).toBe(config);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
