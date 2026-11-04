import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { deprovisionVariant } from "../src/operations/deprovision.js";
import { downVariant } from "../src/operations/down.js";
import { prepareVariant } from "../src/operations/prepare.js";
import type { OperationContext } from "../src/operations/types.js";
import type { DatabaseAdapter } from "../src/types.js";

const yaml = (multi: string, steps = ""): string =>
  `db:\n  dialect: postgres\n  host: 127.0.0.1\n  multi:\n${multi}${steps ? `variant:\n${steps}` : "variant: {}\n"}`;

const withDrop = async (
  text: string,
  catalog: string[],
  run: (tools: { directory: string; context: OperationContext; dropped: string[] }) => Promise<void>,
): Promise<void> => {
  const directory = mkdtempSync(join(tmpdir(), "variant-drop-"));
  const dropped: string[] = [];
  const names = [...catalog];
  const adapter: DatabaseAdapter = {
    dialect: "postgres",
    create: async (slug) => `v_${slug}`,
    createSchema: async (name) => {
      dropped.push(`create ${name}`);
    },
    matchingSchemas: async (prefix) => names.filter((name) => name.startsWith(prefix)),
    dropSchema: async (name) => {
      dropped.push(name);
      const index = names.indexOf(name);
      if (index >= 0) {
        names.splice(index, 1);
      }
    },
    destroy: async (slug) => {
      dropped.push(`destroy ${slug}`);
      return true;
    },
    list: async () => [],
    target: (slug) => `v_${slug.replaceAll("-", "_")}`,
    close: async () => {},
  };
  try {
    writeFileSync(join(directory, "variants.yaml"), text);
    const context: OperationContext = {
      config: loadConfig({ cwd: directory, env: {} }),
      variantRoot: directory,
      stateDir: join(directory, ".cache", "variants"),
      cwd: directory,
      useWorktree: false,
      adapter,
    };
    await run({ directory, context, dropped });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("deprovision", () => {
  it("drops every schema under the prefix and does not run tenantsCmd", () =>
    withDrop(
      yaml("    tenantsCmd: exit 9\n"),
      ["v_demo-east", "v_demo-north", "v_other-east"],
      async ({ context, dropped, directory }) => {
        const result = await deprovisionVariant(context, "demo", { log: () => {} });

        expect(result.dropped).toEqual(["v_demo-east", "v_demo-north"]);
        expect(dropped).toEqual(["v_demo-east", "v_demo-north"]);
        expect(existsSync(join(directory, "cmd.out"))).toBe(false);
      },
    ));

  it("keeps a literal underscore and a hyphen in the slug", () =>
    withDrop(
      yaml("    schemaPrefix: v_${slug}_\n    tenantsCmd: exit 9\n"),
      ["v_my-demo_east", "v_my-demoX"],
      async ({ context, dropped }) => {
        await deprovisionVariant(context, "my-demo", { log: () => {} });

        expect(dropped).toEqual(["v_my-demo_east"]);
      },
    ));

  it("runs a deprovision script once and drops nothing", () =>
    withDrop(
      yaml(
        "    tenants: east,west\n",
        "  steps:\n    deprovision:\n      cmd: sh -c 'echo \"$MULTI_TENANT_LIST\" > out'\n      env:\n        MULTI_TENANT_LIST: ${multi.tenants}\n",
      ),
      ["v_demo-east"],
      async ({ directory, context, dropped }) => {
        const result = await deprovisionVariant(context, "demo", { log: () => {} });

        expect(dropped).toEqual([]);
        expect(readFileSync(join(directory, "out"), "utf8")).toBe("east,west\n");
        expect(result.commands).toHaveLength(1);
      },
    ));

  it("skips the drop when VARIANT_STEP_DEPROVISION is no", async () => {
    process.env.VARIANT_STEP_DEPROVISION = "no";
    try {
      await withDrop(yaml("    tenants: east,west\n"), ["v_demo-east"], async ({ context, dropped }) => {
        const result = await deprovisionVariant(context, "demo", { log: () => {} });

        expect(dropped).toEqual([]);
        expect(result.output).toContain("Skipping step deprovision");
      });
    } finally {
      delete process.env.VARIANT_STEP_DEPROVISION;
    }
  });

  it("down keeps the schemas", () =>
    withDrop(yaml("    tenants: east,west\n"), ["v_demo-east"], async ({ context, dropped }) => {
      await downVariant(context, "demo", { log: () => {} });

      expect(dropped).toEqual([]);
    }));

  it("refuses main", () =>
    withDrop(yaml("    tenants: east\n"), [], async ({ context }) => {
      await expect(deprovisionVariant(context, "main", { log: () => {} })).rejects.toThrow(/primary checkout/);
    }));

  it("drops before provision when watch is asked to reprovision", () =>
    withDrop(yaml("    tenants: east,west\n"), ["v_demo-east"], async ({ context, dropped }) => {
      await prepareVariant(context, "demo", "watch", { log: () => {}, reprovision: true });

      expect(dropped).toEqual(["v_demo-east", "create v_demo-east", "create v_demo-west"]);
    }));

  it("watch without the flag does not drop", () =>
    withDrop(yaml("    tenants: east,west\n"), ["v_demo-east"], async ({ context, dropped }) => {
      await prepareVariant(context, "demo", "watch", { log: () => {} });

      expect(dropped).toEqual(["create v_demo-east", "create v_demo-west"]);
    }));
});
