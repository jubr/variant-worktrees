import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, migrateLegacy, migrateText, readRuntime } from "./index.js";

const withProject = (files: Record<string, string>, run: (directory: string) => void): void => {
  const directory = mkdtempSync(join("/tmp", "variant-legacy-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(directory, name), content);
    }
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const CONFIG = "variants.yaml";
const LOCAL = "variants.local.yaml";

describe("legacy names in variants.yaml", () => {
  it("reads variant.instances as variant.watches with one notice and no unknown-key warning", () =>
    withProject({ [CONFIG]: "variant:\n  instances:\n    fe:\n      kind: vite\n" }, (directory) => {
      const config = loadConfig({ cwd: directory });

      expect(Object.keys(config.variant.watches)).toEqual(["fe"]);
      expect(config.variant.watches.fe?.dir).toBe("fe");
      expect(config.warnings).toEqual([]);
      expect(config.migrations).toHaveLength(1);
      expect(config.migrations[0]).toContain(join(directory, CONFIG));
      expect(config.migrations[0]).toContain("variant.instances");
      expect(config.migrations[0]).toContain("variant.watches");
    }));

  it("uses variant.watches when both names exist and says that variant.instances was ignored", () =>
    withProject(
      {
        [CONFIG]: "variant:\n  instances:\n    old:\n      kind: vite\n  watches:\n    fresh:\n      kind: nestjs\n",
      },
      (directory) => {
        const config = loadConfig({ cwd: directory });

        expect(Object.keys(config.variant.watches)).toEqual(["fresh"]);
        expect(config.warnings).toEqual([]);
        expect(config.migrations).toHaveLength(1);
        expect(config.migrations[0]).toContain("ignored");
        expect(config.migrations[0]).toContain("variant.instances");
      },
    ));

  it("drops variant.reservedPorts with a notice and no warning", () =>
    withProject({ [CONFIG]: "variant:\n  reservedPorts: [3000]\n" }, (directory) => {
      const config = loadConfig({ cwd: directory });

      expect(config.variant.ports.range).toBe("42000-42999");
      expect(config.warnings).toEqual([]);
      expect(config.migrations).toHaveLength(1);
      expect(config.migrations[0]).toContain("variant.reservedPorts");
      expect(config.migrations[0]).toContain("dropped");
    }));

  it("has no migration notice for a current file", () =>
    withProject({ [CONFIG]: "variant:\n  watches:\n    fe:\n      kind: vite\n" }, (directory) => {
      expect(loadConfig({ cwd: directory }).migrations).toEqual([]);
    }));

  it("still fails for a real error next to a legacy name", () =>
    withProject({ [CONFIG]: "variant:\n  instances:\n    fe:\n      kind: ruby\n" }, (directory) => {
      expect(() => loadConfig({ cwd: directory })).toThrow(/kind/);
    }));
});

describe("legacy names in variants.local.yaml", () => {
  const files = {
    [CONFIG]: "variant:\n  watches:\n    fe:\n      kind: vite\n",
    [LOCAL]: "runtime:\n  slug: demo\n  instances:\n    fe:\n      port: 62060\n",
  };

  it("reads runtime.instances as runtime.watches with one notice", () =>
    withProject(files, (directory) => {
      const config = loadConfig({ cwd: directory, env: {} });

      expect(config.runtime?.watches).toEqual({ fe: { port: 62060 } });
      expect(config.migrations).toHaveLength(1);
      expect(config.migrations[0]).toContain(join(directory, LOCAL));
    }));

  it("reads it through readRuntime too", () =>
    withProject(files, (directory) => {
      expect(readRuntime(directory, {})?.watches).toEqual({ fe: { port: 62060 } });
    }));

  it("uses runtime.watches when both exist", () =>
    withProject(
      {
        [CONFIG]: files[CONFIG],
        [LOCAL]: "runtime:\n  instances:\n    fe:\n      port: 1\n  watches:\n    fe:\n      port: 2\n",
      },
      (directory) => {
        expect(readRuntime(directory, {})?.watches).toEqual({ fe: { port: 2 } });
      },
    ));

  it("stays strict about any other unknown key", () =>
    withProject({ [LOCAL]: "runtime:\n  slug: demo\n  colour: red\n" }, (directory) => {
      expect(() => readRuntime(directory, {})).toThrow();
    }));
});

describe("migrateLegacy", () => {
  it("renames the keys in a copy and leaves the input alone", () => {
    const input = { variant: { instances: { fe: { kind: "vite" } }, reservedPorts: [1] }, runtime: { instances: {} } };

    const { data, notices } = migrateLegacy(input, "f.yaml");

    expect(data).toEqual({ variant: { watches: { fe: { kind: "vite" } } }, runtime: { watches: {} } });
    expect(notices).toHaveLength(3);
    expect(input.variant.instances).toBeDefined();
  });

  it("returns the data and no notice for a current document or a non-object", () => {
    expect(migrateLegacy({ variant: { watches: {} } }, "f.yaml")).toEqual({
      data: { variant: { watches: {} } },
      notices: [],
    });
    expect(migrateLegacy(null, "f.yaml")).toEqual({ data: null, notices: [] });
    expect(migrateLegacy("text", "f.yaml")).toEqual({ data: "text", notices: [] });
  });
});

describe("migrateText", () => {
  it("renames the key and keeps comments, order and layout", () => {
    const text = [
      "# project",
      "db:",
      "  dialect: sqlite # engine",
      "variant:",
      "  abbr: vw",
      "  instances: # what runs",
      "    fe:",
      "      kind: vite # the app",
      "      dir: fe",
      "",
      "  open: false",
      "",
    ].join("\n");

    expect(migrateText(text)).toBe(text.replace("instances:", "watches:"));
  });

  it("renames runtime.instances", () => {
    expect(migrateText("runtime:\n  slug: demo\n  instances:\n    fe: { port: 62060 }\n")).toBe(
      "runtime:\n  slug: demo\n  watches:\n    fe: { port: 62060 }\n",
    );
  });

  it("removes variant.reservedPorts and keeps the rest", () => {
    expect(migrateText("variant:\n  abbr: vw\n  reservedPorts:\n    - 3000\n    - 4200\n  open: false\n")).toBe(
      "variant:\n  abbr: vw\n  open: false\n",
    );
  });

  it("removes the old key when the new one is present", () => {
    expect(
      migrateText("variant:\n  instances:\n    old: { kind: vite }\n  watches:\n    fresh: { kind: vite }\n"),
    ).toBe("variant:\n  watches:\n    fresh: { kind: vite }\n");
  });

  it("applies the rename and the removal of a file in one pass", () => {
    expect(
      migrateText(
        "variant:\n  reservedPorts: [3000] # old\n  instances:\n    fe: { kind: vite }\nruntime:\n  instances: {}\n",
      ),
    ).toBe("variant:\n  watches:\n    fe: { kind: vite }\nruntime:\n  watches: {}\n");
  });

  it("migrates a flow-style mapping too", () => {
    const migrated = migrateText("variant: { instances: { fe: { kind: vite } }, reservedPorts: [3000] }\n");

    expect(migrated).toBe("variant: { watches: { fe: { kind: vite } } }\n");
  });

  it("returns nothing for a current file, an empty file and text that is not a mapping", () => {
    expect(migrateText("variant:\n  watches:\n    fe: { kind: vite }\n")).toBeUndefined();
    expect(migrateText("")).toBeUndefined();
    expect(migrateText("- a\n- b\n")).toBeUndefined();
  });

  it("does not touch the file system", () =>
    withProject({ [CONFIG]: "variant:\n  instances: {}\n" }, (directory) => {
      migrateText(readFileSync(join(directory, CONFIG), "utf8"));

      expect(readFileSync(join(directory, CONFIG), "utf8")).toBe("variant:\n  instances: {}\n");
    }));
});

/** Specification: openspec/specs/variant-config/core/spec.md (Legacy template syntax) */
describe("legacy template syntax", () => {
  it("reads former placeholders as ${...} with one notice that names the file", () =>
    withProject(
      {
        [CONFIG]:
          "variant:\n  watches:\n    fe:\n      kind: vite\n      url: http://{{slug}}.{{abbr}}.localhost:{{port}}\n",
      },
      (directory) => {
        const config = loadConfig({ cwd: directory });

        expect(config.variant.watches.fe?.url).toBe("http://${slug}.${abbr}.localhost:${port}");
        expect(config.warnings).toEqual([]);
        expect(config.migrations).toHaveLength(1);
        expect(config.migrations[0]).toContain(join(directory, CONFIG));
      },
    ));

  it("reads a former nested default", () => {
    const { data } = migrateLegacy({ variant: { seed: "echo {{SECRET:-local-{{slug}}}}" } }, "f.yaml");

    expect(data).toEqual({ variant: { seed: "echo ${SECRET:-local-${slug}}" } });
  });

  it("leaves text without a placeholder shape alone", () => {
    const input = { variant: { seed: "echo {{ not a placeholder }} {{}} {{a b}}" } };

    expect(migrateLegacy(input, "f.yaml")).toEqual({ data: input, notices: [] });
  });

  it("leaves regular expressions alone", () => {
    const input = {
      variant: { steps: [{ name: "build", run: "make", filterLinesRegex: "^{{PRICE}}$" }] },
      chatRenamer: { activationPatterns: ["{{x}}"] },
    };

    expect(migrateLegacy(input, "f.yaml")).toEqual({ data: input, notices: [] });
  });

  it("reads the former port template of variants.local.yaml", () =>
    withProject(
      { [LOCAL]: "runtime:\n  slug: demo\n  db:\n    dialect: postgres\n    port: '{{POSTGRES_PORT}}'\n" },
      (directory) => {
        expect(readRuntime(directory, { POSTGRES_PORT: "5433" })?.db?.port).toBe(5433);
      },
    ));

  it("rewrites the text of a file and changes no other character", () => {
    const text =
      "variant:\n  watches:\n    fe:\n      env:\n        overrides:\n          PORT: '{{port}}' # the port\n";

    expect(migrateText(text)).toBe(text.replace("'{{port}}'", "'${port}'"));
  });

  it("rewrites a nested default in the text", () => {
    expect(migrateText('variant:\n  seed: "echo {{SECRET:-local-{{slug}}}}"\n')).toBe(
      'variant:\n  seed: "echo ${SECRET:-local-${slug}}"\n',
    );
  });

  it("rewrites templates together with renamed keys", () => {
    expect(migrateText("variant:\n  instances:\n    fe: { url: 'http://{{slug}}.test' }\n")).toBe(
      "variant:\n  watches:\n    fe: { url: 'http://${slug}.test' }\n",
    );
  });

  it("does not rewrite regular expressions or comments", () => {
    const text = "# {{slug}}\nvariant:\n  steps:\n    - { name: a, run: x, filterLinesRegex: '^{{PRICE}}$' }\n";

    expect(migrateText(text)).toBeUndefined();
  });
});
