import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/index.js";
import {
  groupDatabaseSchemas,
  groupMultiSchemas,
  multiLikePattern,
  multiSchemaName,
  parseMultiList,
} from "../src/multi.js";
import { RuntimeSchema, VariantsConfigSchema } from "../src/schema.js";
import { renderTemplate } from "../src/template.js";

const FILE = "variants.yaml";

const issues = (db: unknown): string => JSON.stringify(VariantsConfigSchema.safeParse({ db }).error?.issues ?? []);

const loaded = (yaml: string) => {
  const directory = mkdtempSync(join("/tmp", "variant-multi-"));
  try {
    writeFileSync(join(directory, FILE), yaml);
    return loadConfig({ cwd: directory, env: {} });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const postgres = (multi: string): string => `db:\n  dialect: postgres\n  host: 127.0.0.1\n  multi:\n${multi}`;

describe("multi-schema settings", () => {
  it("defaults schemaPrefix when only tenantsCmd is set", () => {
    expect(loaded(postgres("    tenantsCmd: echo east,west")).db.multi).toEqual({
      schemaPrefix: "v_${slug}-",
      tenantsCmd: "echo east,west",
    });
  });

  it("accepts a literal list", () => {
    expect(loaded(postgres("    tenants: east,west")).db.multi?.tenants).toBe("east,west");
  });

  it("rejects both list forms and names db.multi", () => {
    expect(issues({ dialect: "postgres", host: "h", multi: { tenants: "east", tenantsCmd: "echo east" } })).toContain(
      "db.multi",
    );
  });

  it("rejects neither list form and names db.multi.tenants", () => {
    expect(issues({ dialect: "postgres", host: "h", multi: {} })).toContain("db.multi.tenants");
    expect(issues({ dialect: "postgres", host: "h", multi: { tenants: "" } })).toContain("tenants");
  });

  it("does not shape the prefix", () => {
    for (const schemaPrefix of ["app_${slug}", "v_${slug}", "v_app-"]) {
      expect(loaded(postgres(`    schemaPrefix: ${schemaPrefix}\n    tenants: east`)).db.multi?.schemaPrefix).toBe(
        schemaPrefix,
      );
    }
  });

  it("shares an env anchor between steps", () => {
    const { steps } = loaded(
      [
        "db:",
        "  dialect: sqlite",
        "variant:",
        "  steps:",
        "    provision:",
        "      cmd: bun run db:provision",
        "      env: &prov-env",
        "        MULTI_TENANT_LIST: ${multi.tenants}",
        "    seed:",
        "      env: *prov-env",
      ].join("\n"),
    ).variant;

    expect(steps.provision?.env).toEqual({ MULTI_TENANT_LIST: "${multi.tenants}" });
    expect(steps.seed?.env).toEqual(steps.provision?.env);
  });

  it("rejects multi on the runtime db", () => {
    expect(() =>
      RuntimeSchema.parse({ db: { dialect: "postgres", schema: "v_demo", multi: { tenants: "east" } } }),
    ).toThrow(/multi/);
  });
});

describe("multi placeholders", () => {
  it("fills the prefix without reading the tenant list", () => {
    let ran = false;

    expect(
      renderTemplate("${multi.schemaPrefix}", {
        multiSchemaPrefix: "v_demo-",
        multiTenants: () => {
          ran = true;
          return "east,west";
        },
      }),
    ).toBe("v_demo-");
    expect(ran).toBe(false);
  });

  it("joins the tenant list", () => {
    expect(renderTemplate("${multi.tenants}", { multiTenants: "east,west" })).toBe("east,west");
  });

  it("renders both placeholders as empty when db.multi is absent", () => {
    expect(renderTemplate("${multi.tenants}", {})).toBe("");
    expect(renderTemplate("${multi.schemaPrefix}", {})).toBe("");
  });

  it("fills ${worktree} in a tenants command", () => {
    expect(renderTemplate("cat ${worktree}/server/.env", { worktree: "/w/demo" })).toBe("cat /w/demo/server/.env");
  });
});

describe("multi names", () => {
  it("parses quotes, whitespace and repeats", () => {
    expect(parseMultiList('"east", west\neast')).toEqual(["east", "west"]);
    expect(parseMultiList("east,west,north")).toEqual(["east", "west", "north"]);
  });

  it("rejects an invalid tenant and names it", () => {
    expect(() => parseMultiList("east,west;x")).toThrow(/west;x/);
  });

  it("appends the tenant to the prefix and keeps a hyphen in the slug", () => {
    expect(multiSchemaName("v_${slug}-", "demo", "east")).toBe("v_demo-east");
    expect(multiSchemaName("v_${slug}_t_", "demo", "east")).toBe("v_demo_t_east");
    expect(multiSchemaName("v_${slug}-", "foo-bar", "east")).toBe("v_foo-bar-east");
  });

  it("escapes like wildcards in the drop pattern", () => {
    expect(multiLikePattern("v_foo_x_")).toBe("v\\_foo\\_x\\_%");
    expect(multiLikePattern("v_demo-")).toBe("v\\_demo-%");
  });

  it("groups names that start with the prefix", () => {
    expect(groupMultiSchemas(["v_foo_x_east", "v_fooxx_east", "app"], "v_foo_x_")).toEqual(["v_foo_x_east"]);
  });

  it("turns an underscored slug and a hyphen tenant into one slug", () => {
    expect(
      groupDatabaseSchemas([
        "v_fix_entra_vbu_login-de99",
        "v_fix_entra_vbu_login-nl21",
        "v_email_transport_mailjet",
        "v_plain",
      ]),
    ).toEqual([
      {
        slug: "fix-entra-vbu-login",
        schemas: ["v_fix_entra_vbu_login-de99", "v_fix_entra_vbu_login-nl21"],
      },
    ]);
  });
});
