import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";
import { createVariant } from "../src/operations/create.js";
import { prepareVariant } from "../src/operations/prepare.js";
import { provisionVariant } from "../src/operations/provision.js";
import type { OperationContext } from "../src/operations/types.js";
import type { DatabaseAdapter } from "../src/types.js";

const postgres = (multi: string, steps = ""): string =>
  `db:\n  dialect: postgres\n  host: 127.0.0.1\n  multi:\n${multi}${steps ? `variant:\n${steps}` : "variant: {}\n"}`;

interface Tools {
  directory: string;
  schemas: string[];
  context: OperationContext;
  logged: string[];
  provision: (slug?: string) => Promise<{ commands: string[]; output: string }>;
}

const withMulti = async (yaml: string, run: (tools: Tools) => Promise<void>): Promise<void> => {
  const directory = mkdtempSync(join(tmpdir(), "variant-multi-"));
  const schemas: string[] = [];
  const adapter: DatabaseAdapter = {
    dialect: "postgres",
    create: async (slug) => {
      schemas.push(`create ${slug}`);
      return `v_${slug}`;
    },
    createSchema: async (name) => {
      schemas.push(name);
    },
    destroy: async () => {
      schemas.push("destroy");
      return true;
    },
    list: async () => [],
    target: (slug) => `v_${slug.replaceAll("-", "_")}`,
    close: async () => {},
  };
  try {
    writeFileSync(join(directory, "variants.yaml"), yaml);
    const logged: string[] = [];
    const context: OperationContext = {
      config: loadConfig({ cwd: directory, env: {} }),
      variantRoot: directory,
      stateDir: join(directory, ".cache", "variants"),
      cwd: directory,
      useWorktree: false,
      adapter,
    };
    await run({
      directory,
      schemas,
      context,
      logged,
      provision: (slug = "demo") => provisionVariant(context, slug, { log: (line) => logged.push(line) }),
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const read = (directory: string, name: string): string => readFileSync(join(directory, name), "utf8");

describe("multi schema", () => {
  it("refuses db.multi on sqlite and mysql and names the dialect", () => {
    const directory = mkdtempSync(join(tmpdir(), "variant-multi-dialect-"));
    try {
      writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n  multi:\n    tenants: east\n");
      expect(() => createClient({ cwd: directory, worktree: false })).toThrow(/sqlite/);
      writeFileSync(
        join(directory, "variants.yaml"),
        "db:\n  dialect: mysql\n  host: 127.0.0.1\n  multi:\n    tenants: east\n",
      );
      expect(() => createClient({ cwd: directory, worktree: false })).toThrow(/mysql/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("creates the worktree state and no schema", () =>
    withMulti(postgres("    tenants: east,west\n"), async ({ context, schemas }) => {
      const created = await createVariant(context, "demo");

      expect(created.target).toBe("v_demo");
      expect(schemas).toEqual([]);
    }));

  it("creates one schema per tenant and runs no provision command", () =>
    withMulti(postgres("    tenants: east,west\n"), async ({ schemas, provision }) => {
      const result = await provision();

      expect(schemas).toEqual(["v_demo-east", "v_demo-west"]);
      expect(result.commands).toEqual([]);
    }));

  it("keeps a hyphen in the slug and uses a custom prefix", () =>
    withMulti(postgres("    schemaPrefix: v_${slug}_t_\n    tenants: east\n"), async ({ schemas, provision }) => {
      await provision("my-demo");

      expect(schemas).toEqual(["v_my-demo_t_east"]);
    }));

  it("creates a missing schema on watch and does not drop", () =>
    withMulti(postgres("    tenants: east,west\n"), async ({ context, schemas }) => {
      await prepareVariant(context, "demo", "watch", { log: () => {} });

      expect(schemas).toEqual(["v_demo-east", "v_demo-west"]);
    }));

  it("runs a provision script once and creates no schema", () =>
    withMulti(
      postgres(
        "    tenants: east,west\n",
        "  steps:\n    provision:\n      cmd: sh -c 'echo \"$MULTI_TENANT_LIST\" >> out'\n      env:\n        MULTI_TENANT_LIST: ${multi.tenants}\n",
      ),
      async ({ directory, schemas, logged, provision }) => {
        await provision();

        expect(schemas).toEqual([]);
        expect(read(directory, "out")).toBe("east,west\n");
        expect(logged.some((line) => line.startsWith("+ sh -c"))).toBe(true);
      },
    ));

  it("runs the seed once from the provision env anchor and reads the list once", () =>
    withMulti(
      postgres(
        "    tenantsCmd: sh -c 'echo x >> reads; printf %s east,west'\n",
        [
          "  steps:",
          "    provision:",
          "      cmd: 'echo once >> count'",
          "      env: &prov-env",
          "        MULTI_TENANT_LIST: ${multi.tenants}",
          "    seed:",
          "      cmd: sh -c 'echo \"$MULTI_TENANT_LIST\" >> out'",
          "      env: *prov-env",
        ].join("\n"),
      ),
      async ({ directory, schemas, provision }) => {
        await provision();

        expect(schemas).toEqual([]);
        expect(read(directory, "out")).toBe("east,west\n");
        expect(read(directory, "count")).toBe("once\n");
        expect(read(directory, "reads")).toBe("x\n");
      },
    ));

  it("gives the script the list, the prefix and the variant schema", () =>
    withMulti(
      postgres(
        "    schemaPrefix: v_${slug}-\n    tenants: east,west\n",
        "  steps:\n    provision:\n      cmd: 'env > env.out'\n      env:\n        MULTI_TENANT_LIST: ${multi.tenants}\n        MULTI_SCHEMA_PREFIX: ${multi.schemaPrefix}\n",
      ),
      async ({ directory, provision }) => {
        await provision();
        const env = Object.fromEntries(
          read(directory, "env.out")
            .trim()
            .split("\n")
            .map((line) => {
              const at = line.indexOf("=");
              return [line.slice(0, at), line.slice(at + 1)];
            }),
        );

        expect(env.MULTI_TENANT_LIST).toBe("east,west");
        expect(env.MULTI_SCHEMA_PREFIX).toBe("v_demo-");
        expect(env.POSTGRES_SCHEMA).toBe("v_demo");
      },
    ));

  it("lets the step env win over the process environment", async () => {
    const previous = process.env.MULTI_SCHEMA_PREFIX;
    process.env.MULTI_SCHEMA_PREFIX = "from-process";
    try {
      await withMulti(
        postgres(
          "    tenants: east\n",
          "  steps:\n    seed:\n      cmd: 'echo \"$MULTI_SCHEMA_PREFIX\" > out'\n      env: { MULTI_SCHEMA_PREFIX: fixed }\n",
        ),
        async ({ directory, provision }) => {
          await provision();

          expect(read(directory, "out")).toBe("fixed\n");
        },
      );
    } finally {
      if (previous === undefined) {
        delete process.env.MULTI_SCHEMA_PREFIX;
      } else {
        process.env.MULTI_SCHEMA_PREFIX = previous;
      }
    }
  });

  it("runs a custom step once after seed", () =>
    withMulti(
      postgres(
        "    tenants: east,west\n",
        "  steps:\n    seed:\n      cmd: 'echo seed >> order'\n    migrations:\n      cmd: 'echo mig >> order'\n      runAfter: seed\n",
      ),
      async ({ directory, provision }) => {
        await provision();

        expect(read(directory, "order")).toBe("seed\nmig\n");
      },
    ));

  it("names the step and the status when provision fails and runs nothing later", () =>
    withMulti(
      postgres(
        "    tenants: east\n",
        "  steps:\n    provision:\n      cmd: 'echo boom; exit 3'\n    seed:\n      cmd: 'echo seed > seed.out'\n",
      ),
      async ({ directory, provision }) => {
        const failure = await provision().catch((error: Error) => error);

        expect((failure as Error).message).toContain("provision");
        expect((failure as Error).message).toContain("3");
        expect(existsSync(join(directory, "seed.out"))).toBe(false);
      },
    ));

  it("skips a provision script and does not create schemas", async () => {
    process.env.VARIANT_STEP_PROVISION = "no";
    try {
      await withMulti(
        postgres("    tenants: east,west\n", "  steps:\n    provision:\n      cmd: 'echo ran > out'\n"),
        async ({ directory, schemas, provision }) => {
          const result = await provision();

          expect(schemas).toEqual([]);
          expect(existsSync(join(directory, "out"))).toBe(false);
          expect(result.output).toContain("Skipping step provision");
        },
      );
    } finally {
      delete process.env.VARIANT_STEP_PROVISION;
    }
  });

  it("creates the schemas and runs no seed when no seed step is set", () =>
    withMulti(postgres("    tenants: east,west\n"), async ({ schemas, provision }) => {
      const result = await provision();

      expect(schemas).toEqual(["v_demo-east", "v_demo-west"]);
      expect(result.commands).toEqual([]);
    }));

  it("renders an empty tenant list when db.multi is absent", () =>
    withMulti(
      "db:\n  dialect: sqlite\nvariant:\n  steps:\n    seed:\n      cmd: 'echo \"[$MULTI_TENANT_LIST]\" > out'\n      env:\n        MULTI_TENANT_LIST: ${multi.tenants}\n",
      async ({ directory, schemas, provision }) => {
        await provision();

        expect(read(directory, "out")).toBe("[]\n");
        expect(schemas).toEqual(["create demo"]);
      },
    ));

  it("reads the list from a file in the worktree and keeps the order", () =>
    withMulti(
      postgres("    tenantsCmd: awk -F= '/^WITCHES=/{print $2}' ${worktree}/server/.env\n"),
      async ({ directory, schemas, provision }) => {
        mkdirSync(join(directory, "server"));
        writeFileSync(join(directory, "server", ".env"), "WITCHES=east,west,north\n");

        await provision();

        expect(schemas).toEqual(["v_demo-east", "v_demo-west", "v_demo-north"]);
      },
    ));

  it("strips quotes and drops repeats from the command output", () =>
    withMulti(postgres("    tenantsCmd: printf '%s\\n' '\"east\", west' east\n"), async ({ schemas, provision }) => {
      await provision();

      expect(schemas).toEqual(["v_demo-east", "v_demo-west"]);
    }));

  it("puts the worktree path into tenantsCmd", () =>
    withMulti(
      postgres("    tenantsCmd: sh -c 'echo ${worktree} > trace; printf %s east'\n"),
      async ({ directory, provision }) => {
        await provision();

        expect(read(directory, "trace").trim()).toBe(directory);
      },
    ));

  it("names the command and the status when tenantsCmd fails and creates no schema", () =>
    withMulti(postgres("    tenantsCmd: exit 2\n"), async ({ schemas, provision }) => {
      const failure = await provision().catch((error: Error) => error);

      expect((failure as Error).message).toContain("exit 2");
      expect((failure as Error).message).toContain("(2)");
      expect(schemas).toEqual([]);
    }));

  it("names the command when tenantsCmd prints no value", () =>
    withMulti(postgres("    tenantsCmd: 'true'\n"), async ({ provision }) => {
      const failure = await provision().catch((error: Error) => error);

      expect((failure as Error).message).toContain("true");
      expect((failure as Error).message).toContain("no value");
    }));

  it("names the command and the invalid value and creates no schema", () =>
    withMulti(postgres("    tenantsCmd: printf '%s' 'east,west;x'\n"), async ({ schemas, provision }) => {
      const failure = await provision().catch((error: Error) => error);

      expect((failure as Error).message).toContain("west;x");
      expect((failure as Error).message).toContain("printf");
      expect(schemas).toEqual([]);
    }));

  it("does not run tenantsCmd to expand the prefix", () =>
    withMulti(
      postgres(
        "    schemaPrefix: v_${slug}-\n    tenantsCmd: exit 9\n",
        "  steps:\n    provision:\n      cmd: 'echo \"$MULTI_SCHEMA_PREFIX\" > out'\n      env:\n        MULTI_SCHEMA_PREFIX: ${multi.schemaPrefix}\n",
      ),
      async ({ directory, schemas, provision }) => {
        await provision();

        expect(read(directory, "out")).toBe("v_demo-\n");
        expect(schemas).toEqual([]);
      },
    ));
});
