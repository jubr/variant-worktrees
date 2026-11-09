import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "./index.js";

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

const RECORD = `
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const [who, arg] = process.argv.slice(2);
writeFileSync(join(process.env.MARK, who + ".json"), JSON.stringify({
  port: process.env.PORT ?? "",
  spa: process.env.VARIANT_SPA_PORT ?? "",
  api: process.env.VARIANT_API_PORT ?? "",
  arg: arg ?? "",
}));
setInterval(() => {}, 1000);
`;

describe("watch from the worktree file", () => {
  it("starts the worktree api and spa commands with their ports, not the primary checkout commands", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-worktree-watch-")));
    const workspace = join(parent, "work");
    const main = join(workspace, "app");
    const linked = join(workspace, "_v-demo");
    const mark = join(parent, "mark");
    mkdirSync(main, { recursive: true });
    mkdirSync(mark);
    execFileSync("git", ["init", "-q", "-b", "main", main]);
    git(main, "config", "user.email", "variant@example.test");
    git(main, "config", "user.name", "Variant Tests");
    writeFileSync(join(main, "AGENTS.md"), "# main\n");
    writeFileSync(join(main, "record.js"), RECORD);
    writeFileSync(
      join(main, "variants.yaml"),
      [
        "db: { dialect: sqlite }",
        "variant:",
        "  open: false",
        "  supervise: { startDelaySeconds: 0, checkoutPollSeconds: 0 }",
        "  watches:",
        `    fe: { watch: "${process.execPath} record.js primary-dev" }`,
        `    api: { watch: "${process.execPath} record.js primary-start" }`,
        "",
      ].join("\n"),
    );
    git(main, "add", ".");
    git(main, "commit", "-q", "-m", "initial");
    symlinkSync(join(main, "AGENTS.md"), join(workspace, "AGENTS.md"));
    git(main, "worktree", "add", "-q", "-b", "feat/demo", linked, "main");
    writeFileSync(
      join(linked, "variants.yaml"),
      [
        "db: { dialect: sqlite }",
        "variant:",
        "  open: false",
        "  supervise: { startDelaySeconds: 0, checkoutPollSeconds: 0 }",
        "  watches:",
        "    api:",
        "      dir: .",
        `      watch: "${process.execPath} record.js api"`,
        "      env:",
        "        overrides:",
        "          PORT: ${port}",
        "    spa:",
        "      dir: .",
        `      watch: "${process.execPath} record.js spa \\"$VARIANT_SPA_PORT\\""`,
        "      env:",
        "        overrides:",
        "          VARIANT_API_PORT: ${api.port}",
        "",
      ].join("\n"),
    );
    const saved = process.env.MARK;
    process.env.MARK = mark;
    const client = createClient({
      cwd: linked,
      config: loadConfig({ cwd: linked, env: {} }),
      stateDir: join(linked, ".cache", "variants"),
    });
    const abort = new AbortController();
    const done = client.watch("demo", { signal: abort.signal, log: () => {} });
    try {
      for (const deadline = Date.now() + 8000; Date.now() < deadline; await sleep(25)) {
        if (existsSync(join(mark, "api.json")) && existsSync(join(mark, "spa.json"))) {
          break;
        }
      }
      const api = JSON.parse(readFileSync(join(mark, "api.json"), "utf8")) as { port: string };
      const spa = JSON.parse(readFileSync(join(mark, "spa.json"), "utf8")) as { spa: string; api: string; arg: string };
      expect(api.port).toMatch(/^\d+$/);
      expect(spa.spa).toMatch(/^\d+$/);
      expect(spa.api).toBe(api.port);
      expect(spa.arg).toBe(spa.spa);
      expect(existsSync(join(mark, "primary-dev.json"))).toBe(false);
      expect(existsSync(join(mark, "primary-start.json"))).toBe(false);
    } finally {
      abort.abort();
      await done.catch(() => undefined);
      if (saved === undefined) {
        delete process.env.MARK;
      } else {
        process.env.MARK = saved;
      }
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
