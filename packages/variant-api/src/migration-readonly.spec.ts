import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createVariantClient } from "./index.js";

const OLD =
  "db:\n  dialect: sqlite\nvariant:\n  reservedPorts: [3000]\n  instances:\n    be: { kind: nestjs, dir: . }\n";
const OLD_LOCAL = "runtime:\n  slug: main\n  instances:\n    be: { port: 62060 }\n";

describe("legacy configuration in the library", () => {
  it("reads old names and leaves both files byte for byte as they were", async () => {
    const directory = mkdtempSync(join("/tmp", "variant-readonly-"));
    try {
      writeFileSync(join(directory, "variants.yaml"), OLD);
      writeFileSync(join(directory, "variants.local.yaml"), OLD_LOCAL);

      const config = loadConfig({ cwd: directory, env: {} });
      const client = createVariantClient({ cwd: directory, stateDir: join(directory, ".cache"), worktree: false });
      const records = await client.list();

      expect(Object.keys(config.variant.watches)).toEqual(["be"]);
      expect(config.migrations).toHaveLength(3);
      expect(client.config().variant.watches.be?.kind).toBe("nestjs");
      expect(records).toBeArray();
      expect(readFileSync(join(directory, "variants.yaml"), "utf8")).toBe(OLD);
      expect(readFileSync(join(directory, "variants.local.yaml"), "utf8")).toBe(OLD_LOCAL);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
