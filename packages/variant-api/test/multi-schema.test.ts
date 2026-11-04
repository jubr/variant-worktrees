import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";
import { createVariant } from "../src/operations/create.js";
import { implodeVariant } from "../src/operations/implode.js";
import { listVariants } from "../src/operations/list.js";
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
    matchingSchemas: async (prefix) => {
      schemas.push(`match ${prefix}`);
      return [];
    },
    dropSchema: async (name) => {
      schemas.push(`drop ${name}`);
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

/** Schemas the database already holds, listed under the variant the worktree names. */
const withSchemas = async (
  names: readonly string[],
  yaml: string,
  run: (tools: { directory: string; list: () => ReturnType<typeof listVariants> }) => Promise<void>,
): Promise<void> => {
  const directory = mkdtempSync(join(tmpdir(), "variant-multi-list-"));
  const adapter: DatabaseAdapter = {
    dialect: "postgres",
    create: async (slug) => `v_${slug}`,
    createSchema: async () => {},
    matchingSchemas: async (prefix) => names.filter((name) => name.startsWith(prefix)),
    dropSchema: async () => {},
    destroy: async () => true,
    list: async () => names.filter((name) => name.startsWith("v_")),
    target: (slug) => `v_${slug.replaceAll("-", "_")}`,
    close: async () => {},
  };
  try {
    writeFileSync(join(directory, "variants.yaml"), yaml);
    const config = loadConfig({ cwd: directory, env: {} });
    const context: OperationContext = {
      config,
      variantRoot: config.variant.root,
      stateDir: join(directory, ".cache", "variants"),
      cwd: directory,
      useWorktree: false,
      adapter,
    };
    await run({ directory: config.variant.root, list: () => listVariants(context) });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("one record per variant", () => {
  it("groups every schema of the worktree under one record", () =>
    withSchemas(
      ["v_demo-east", "v_demo-west", "v_demo-north"],
      postgres("    tenants: east,west,north\n"),
      async ({ directory, list }) => {
        mkdirSync(join(directory, "_v-demo"));

        const records = await list();

        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
          slug: "demo",
          target: "v_demo",
          schemas: ["v_demo-east", "v_demo-north", "v_demo-west"],
        });
        expect(records[0]).not.toHaveProperty("dbOnly");
      },
    ));

  it("keeps a hyphen in the slug and reports the variant target", () =>
    withSchemas(["v_add-auth-east"], postgres("    tenants: east\n"), async ({ directory, list }) => {
      mkdirSync(join(directory, "_v-add-auth"));

      const [record] = await list();

      expect(record).toMatchObject({
        slug: "add-auth",
        target: "v_add_auth",
        schemas: ["v_add-auth-east"],
      });
    }));

  it("omits schemas when db.multi is absent", () =>
    withSchemas(["v_demo"], "db:\n  dialect: postgres\n  host: 127.0.0.1\nvariant: {}\n", async ({ list }) => {
      const [record] = await list();

      expect(record?.slug).toBe("demo");
      expect(record).not.toHaveProperty("schemas");
    }));

  it("keeps a schema whose tenant has left the list", () =>
    withSchemas(["v_demo-east", "v_demo-north"], postgres("    tenants: east\n"), async ({ directory, list }) => {
      mkdirSync(join(directory, "_v-demo"));

      const [record] = await list();

      expect(record?.schemas).toEqual(["v_demo-east", "v_demo-north"]);
    }));

  it("groups database schemas that share a prefix when no worktree exists", () =>
    withSchemas(
      ["v_demo-east", "v_demo-west", "v_other-east"],
      postgres("    tenantsCmd: exit 9\n"),
      async ({ list }) => {
        const records = await list();

        expect(records.map((record) => record.slug).sort()).toEqual(["demo", "other"]);
        expect(records.find((record) => record.slug === "demo")).toMatchObject({
          target: "v_demo",
          schemas: ["v_demo-east", "v_demo-west"],
          worktree: undefined,
          dbOnly: true,
        });
        expect(records.find((record) => record.slug === "other")?.schemas).toEqual(["v_other-east"]);
      },
    ));

  it("keeps a hyphenated slug and takes the tenant after the last separator", () =>
    withSchemas(
      ["v_fix-entra-vbu-login-de99", "v_fix-entra-vbu-login-fr15", "v_plain"],
      postgres("    tenantsCmd: exit 9\n"),
      async ({ list }) => {
        const records = await list();

        expect(records.find((record) => record.slug === "fix-entra-vbu-login")?.schemas).toEqual([
          "v_fix-entra-vbu-login-de99",
          "v_fix-entra-vbu-login-fr15",
        ]);
        expect(records.find((record) => record.slug === "plain")?.schemas).toEqual([]);
        expect(records.some((record) => record.slug === "fix")).toBe(false);
      },
    ));

  it("groups schemas whose prefix is not v_ when no worktree exists", () =>
    withSchemas(
      ["app_demo_east", "app_demo_west"],
      postgres("    schemaPrefix: app_${slug}_\n    tenantsCmd: exit 9\n"),
      async ({ list }) => {
        const [record] = await list();

        expect(record).toMatchObject({
          slug: "demo",
          schemas: ["app_demo_east", "app_demo_west"],
        });
      },
    ));

  it("groups schemas of a variant known only from its state file", () =>
    withSchemas(["v_demo-east"], postgres("    tenants: east\n"), async ({ directory, list }) => {
      const stateDir = join(directory, ".cache", "variants");
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(
        join(stateDir, "demo.yaml"),
        'slug: demo\ntarget: v_demo\ndialect: postgres\nstatePath: ""\ncreatedAt: now\n',
      );

      const records = await list();

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ slug: "demo", target: "v_demo", schemas: ["v_demo-east"] });
    }));

  it("groups a schema under a prefix that does not start with v_", () =>
    withSchemas(
      ["app_demo_east"],
      postgres("    schemaPrefix: app_${slug}_\n    tenants: east\n"),
      async ({ directory, list }) => {
        mkdirSync(join(directory, "_v-demo"));

        const [record] = await list();

        expect(record).toMatchObject({ slug: "demo", target: "v_demo", schemas: ["app_demo_east"] });
      },
    ));

  it("drops the schemas on a later implode after the worktree directory is gone", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-implode-gone-")));
    const repo = join(parent, "repo");
    const dropped: string[] = [];
    const names = ["v_demo-east", "v_demo-west"];
    try {
      execFileSync("git", ["init", "-q", "-b", "main", repo]);
      execFileSync("git", ["-C", repo, "config", "user.email", "variant@example.test"]);
      execFileSync("git", ["-C", repo, "config", "user.name", "Variant Tests"]);
      writeFileSync(join(repo, "variants.yaml"), postgres("    tenantsCmd: exit 9\n"));
      execFileSync("git", ["-C", repo, "add", "."]);
      execFileSync("git", ["-C", repo, "commit", "-q", "-m", "initial"]);
      const worktree = join(parent, "_v-demo");
      execFileSync("git", ["-C", repo, "worktree", "add", "-q", "-b", "feat/demo", worktree]);
      rmSync(worktree, { recursive: true, force: true });
      const config = loadConfig({ cwd: repo, env: {} });
      mkdirSync(join(repo, ".cache", "variants"), { recursive: true });
      writeFileSync(
        join(repo, ".cache", "variants", "demo.yaml"),
        `slug: demo\ntarget: v_demo\ndialect: postgres\nstatePath: ""\ncreatedAt: now\nworktree: ${worktree}\n`,
      );
      const context: OperationContext = {
        config,
        variantRoot: config.variant.root,
        stateDir: join(repo, ".cache", "variants"),
        cwd: repo,
        useWorktree: true,
        adapter: {
          dialect: "postgres",
          create: async (slug) => `v_${slug}`,
          createSchema: async () => {},
          matchingSchemas: async (prefix) => names.filter((name) => name.startsWith(prefix)),
          dropSchema: async (name) => {
            dropped.push(name);
            const index = names.indexOf(name);
            if (index >= 0) {
              names.splice(index, 1);
            }
          },
          destroy: async () => false,
          list: async () => [...names],
          target: (slug) => `v_${slug.replaceAll("-", "_")}`,
          close: async () => {},
        },
      };

      const [before] = await listVariants(context);
      expect(before?.implodeClean).toBe(true);

      const first = await implodeVariant(context, "demo", { log: () => {} });
      const second = await implodeVariant(context, "demo", { log: () => {} });

      expect(first).toMatchObject({ slug: "demo" });
      expect(dropped).toEqual(["v_demo-east", "v_demo-west"]);
      expect(second).toMatchObject({ slug: "demo" });
      expect(names).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("does not run tenantsCmd while grouping schemas", () =>
    withSchemas(["v_demo-east"], postgres("    tenantsCmd: exit 9\n"), async ({ directory, list }) => {
      mkdirSync(join(directory, "_v-demo"));

      const [record] = await list();

      expect(record?.schemas).toEqual(["v_demo-east"]);
    }));
});
