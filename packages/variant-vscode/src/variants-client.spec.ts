import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadVariantClient } from "./variants-client.ts";

/** Specification: openspec/specs/variant-vscode/variants-tree/spec.md (Actions read the current configuration) */

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join("/tmp", "variant-client-")));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Writes `variants.yaml` and moves its modification time on by `seconds`, so a same-size edit still differs. */
const writeConfig = (text: string, seconds: number): void => {
  const file = join(root, "variants.yaml");
  writeFileSync(file, text);
  const at = new Date(Date.now() + seconds * 1000);
  utimesSync(file, at, at);
};

/** The watch commands the library of this client has read. */
const commands = async (load: ReturnType<typeof loadVariantClient>): Promise<Record<string, string | undefined>> => {
  const client = (await load()) as unknown as {
    config: () => { variant: { watches: Record<string, { watch?: string }> } };
  };
  return Object.fromEntries(Object.entries(client.config().variant.watches).map(([key, w]) => [key, w.watch]));
};

describe("loadVariantClient and the configuration file", () => {
  it("reuses the client while variants.yaml is unchanged", async () => {
    writeConfig("variant:\n  abbr: vp\n", 0);
    const load = loadVariantClient(root);

    expect(await load()).toBe(await load());
  });

  it("makes a new client that reads a watch added to variants.yaml, without a reload", async () => {
    writeConfig("variant:\n  abbr: vp\n  watches:\n    app:\n      dir: .\n", 0);
    const load = loadVariantClient(root);
    expect(await commands(load)).toEqual({ app: undefined });

    writeConfig("variant:\n  abbr: vp\n  watches:\n    app:\n      dir: .\n      watch: npm run watch\n", 5);

    expect(await commands(load)).toEqual({ app: "npm run watch" });
  });

  it("makes a new client for a variants.yaml that did not exist at the first use", async () => {
    const load = loadVariantClient(root);
    const first = await load();

    writeConfig("variant:\n  abbr: vp\n  watches:\n    app:\n      dir: .\n      watch: npm run watch\n", 0);

    const second = await load();
    expect(second).not.toBe(first);
    expect(await commands(load)).toEqual({ app: "npm run watch" });
  });

  it("makes a new client when the file changed in size and keeps it afterwards", async () => {
    writeConfig("variant:\n  abbr: vp\n", 0);
    const load = loadVariantClient(root);
    const first = await load();

    writeConfig("variant:\n  abbr: vp\n  open: false\n", 0);

    const second = await load();
    expect(second).not.toBe(first);
    expect(await load()).toBe(second);
  });
});
