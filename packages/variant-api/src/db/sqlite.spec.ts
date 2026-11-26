import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createDatabaseAdapter } from "./index.js";
import { loadDatabase, SqliteAdapter, type SqliteLayout } from "./sqlite.js";

describe("sqlite driver selection", () => {
  it("fails with an error naming SQLite and Node 22.13 when the runtime has no driver", async () => {
    const missing = async (): Promise<never> => {
      throw new Error("No such built-in module: node:sqlite");
    };
    await expect(loadDatabase(false, missing)).rejects.toThrow(/SQLite.*Node 22\.13/);
  });

  it("asks for bun:sqlite under Bun and node:sqlite under Node", async () => {
    const asked: string[] = [];
    const load = async (specifier: string): Promise<Record<string, unknown>> => {
      asked.push(specifier);
      return { Database: class {}, DatabaseSync: class {} };
    };
    await loadDatabase(true, load);
    await loadDatabase(false, load);
    expect(asked).toEqual(["bun:sqlite", "node:sqlite"]);
  });
});

/** The directories of a workspace: the main checkout `<root>/main` and the worktrees `<root>/_v-<slug>`. */
const worktrees = (root: string, slugs: string[] = []): SqliteLayout => ({
  directoryOf: (slug) => (slug === "main" ? join(root, "main") : join(root, `_v-${slug}`)),
  slugs: () => slugs,
});

/** Without worktrees every slug shares the directory of `variants.yaml`. */
const shared = (directory: string, slugs: string[] = []): SqliteLayout => ({
  directoryOf: () => directory,
  slugs: () => slugs,
});

const workspace = (run: (root: string) => void | Promise<void>) => async (): Promise<void> => {
  const root = mkdtempSync(join("/tmp", "variant-sqlite-"));
  try {
    await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

/** Specification: openspec/specs/variant-api/core/spec.md (One SQLite target for every slug) */
describe("SqliteAdapter target", () => {
  it(
    "resolves the default file against the directory of the variant, main included",
    workspace((root) => {
      const adapter = new SqliteAdapter({ dialect: "sqlite" }, worktrees(root));

      expect(adapter.target("demo")).toBe(join(root, "_v-demo", ".cache", "variants", "demo.sqlite"));
      expect(adapter.target("main")).toBe(join(root, "main", ".cache", "variants", "main.sqlite"));
    }),
  );

  it(
    "resolves an explicit relative file against the directory of each variant",
    workspace((root) => {
      const adapter = new SqliteAdapter({ dialect: "sqlite", database: "data/abc.sqlite" }, worktrees(root));

      expect(adapter.target("demo")).toBe(join(root, "_v-demo", "data", "abc.sqlite"));
      expect(adapter.target("main")).toBe(join(root, "main", "data", "abc.sqlite"));
    }),
  );

  it(
    "fills {slug} in a relative and in an absolute file",
    workspace((root) => {
      const relative = new SqliteAdapter({ dialect: "sqlite", database: "db-{slug}.sqlite" }, worktrees(root));
      const absolute = new SqliteAdapter(
        { dialect: "sqlite", database: join(root, "all", "{slug}.sqlite") },
        worktrees(root),
      );

      expect(relative.target("demo")).toBe(join(root, "_v-demo", "db-demo.sqlite"));
      expect(absolute.target("demo")).toBe(join(root, "all", "demo.sqlite"));
      expect(absolute.target("main")).toBe(join(root, "all", "main.sqlite"));
    }),
  );

  it(
    "uses an absolute file without {slug} for main and <slug> plus its extension beside it for the others",
    workspace((root) => {
      const adapter = new SqliteAdapter(
        { dialect: "sqlite", database: join(root, "all", "app.sqlite") },
        worktrees(root),
      );

      expect(adapter.target("main")).toBe(join(root, "all", "app.sqlite"));
      expect(adapter.target("demo")).toBe(join(root, "all", "demo.sqlite"));
    }),
  );

  it(
    "resolves a relative file against the directory of variants.yaml when worktrees are not used",
    workspace((root) => {
      const adapter = new SqliteAdapter({ dialect: "sqlite" }, shared(root));

      expect(adapter.target("demo")).toBe(join(root, ".cache", "variants", "demo.sqlite"));
      expect(adapter.target("main")).toBe(join(root, ".cache", "variants", "main.sqlite"));
    }),
  );

  it(
    "fails naming the slug and db.database when the file of a slug would be the file of main",
    workspace((root) => {
      const sharedFile = new SqliteAdapter({ dialect: "sqlite", database: "app.sqlite" }, shared(root));
      expect(() => sharedFile.target("demo")).toThrow(/demo.*db\.database.*app\.sqlite/);
      expect(sharedFile.target("main")).toBe(join(root, "app.sqlite"));

      const named = new SqliteAdapter({ dialect: "sqlite", database: join(root, "demo.sqlite") }, worktrees(root));
      expect(() => named.target("demo")).toThrow(/demo.*db\.database/);
      expect(named.target("other")).toBe(join(root, "other.sqlite"));
    }),
  );
});

describe("SqliteAdapter files", () => {
  it(
    "creates and destroys the file of a slug below its worktree",
    workspace(async (root) => {
      const adapter = new SqliteAdapter({ dialect: "sqlite" }, worktrees(root, ["test-feature"]));
      try {
        const target = await adapter.create("test-feature");
        expect(target).toBe(join(root, "_v-test-feature", ".cache", "variants", "test-feature.sqlite"));
        expect(existsSync(target)).toBe(true);
        expect(await adapter.list()).toEqual(["test-feature"]);
        expect(await adapter.destroy("test-feature")).toBe(true);
        expect(existsSync(target)).toBe(false);
        expect(await adapter.destroy("test-feature")).toBe(false);
        expect(await adapter.list()).toEqual([]);
      } finally {
        await adapter.close();
      }
    }),
  );

  it(
    "lists the files of the worktrees for a relative file, and never main",
    workspace((root) => {
      const adapter = new SqliteAdapter({ dialect: "sqlite" }, worktrees(root, ["alpha", "beta", "gamma"]));
      for (const slug of ["alpha", "beta", "main"]) {
        const file = adapter.target(slug);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, "");
      }

      return expect(adapter.list()).resolves.toEqual(["alpha", "beta"]);
    }),
  );

  it(
    "lists the files of an absolute directory by their names, never main",
    workspace(async (root) => {
      const directory = join(root, "all");
      mkdirSync(directory);
      for (const name of ["a.sqlite", "b.sqlite", "app.sqlite", "notes.txt"]) {
        writeFileSync(join(directory, name), "");
      }
      const plain = new SqliteAdapter({ dialect: "sqlite", database: join(directory, "app.sqlite") }, worktrees(root));
      expect(await plain.list()).toEqual(["a", "b"]);

      mkdirSync(join(directory, "slugged"));
      for (const name of ["x.sqlite", "main.sqlite"]) {
        writeFileSync(join(directory, "slugged", name), "");
      }
      const template = new SqliteAdapter(
        { dialect: "sqlite", database: join(directory, "slugged", "{slug}.sqlite") },
        worktrees(root),
      );
      expect(await template.list()).toEqual(["x"]);
    }),
  );

  it(
    "lists nothing for a directory that does not exist",
    workspace(async (root) => {
      const adapter = new SqliteAdapter(
        { dialect: "sqlite", database: join(root, "nope", "{slug}.sqlite") },
        worktrees(root),
      );

      expect(await adapter.list()).toEqual([]);
    }),
  );
});

describe("createDatabaseAdapter", () => {
  it("rejects unknown database dialects", () => {
    expect(() => createDatabaseAdapter({ dialect: "oracle" as never }, shared("/tmp"))).toThrow(
      "Unsupported database dialect: oracle",
    );
  });
});
