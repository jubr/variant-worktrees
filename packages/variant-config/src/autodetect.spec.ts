import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { detectConnection, detectDefaultBranch } from "./autodetect.js";

describe("detectConnection", () => {
  it("reads PostgreSQL values from the environment provider", () => {
    const detected = detectConnection("/proj", () => ({
      POSTGRES_HOST: "127.0.0.1",
      POSTGRES_PORT: "5432",
      POSTGRES_USER: "variant",
      POSTGRES_PASSWORD: "secret",
      POSTGRES_DB: "variants",
      POSTGRES_SSL: "false",
    }));

    expect(detected.source).toBe("env");
    expect(detected.config).toMatchObject({
      dialect: "postgres",
      host: "127.0.0.1",
      port: 5432,
      user: "variant",
      password: "secret",
      database: "variants",
      ssl: false,
    });
  });

  it("falls back to one SQLite file per slug when nothing is set", () => {
    const detected = detectConnection("/proj", () => ({}));

    expect(detected.source).toBe("default");
    expect(detected.config).toEqual({ dialect: "sqlite", database: ".cache/variants/{slug}.sqlite" });
  });
});

/** Specification: openspec/specs/variant-config/core/spec.md (SQLite database file) */
describe("detectConnection for SQLite", () => {
  it("reads SQLITE_DATABASE and SQLITE_PATH as the database file, the first one winning", () => {
    expect(detectConnection("/proj", () => ({ SQLITE_DATABASE: "a.sqlite" })).config).toEqual(
      expect.objectContaining({ dialect: "sqlite", database: "a.sqlite" }),
    );
    expect(detectConnection("/proj", () => ({ SQLITE_PATH: "/data/b.sqlite" })).config).toEqual(
      expect.objectContaining({ dialect: "sqlite", database: "/data/b.sqlite" }),
    );
    const both = detectConnection("/proj", () => ({ SQLITE_DATABASE: "a.sqlite", SQLITE_PATH: "/x.sqlite" }));
    expect(both.config.database).toBe("a.sqlite");
    expect(both.config).not.toHaveProperty("filename");
  });

  it("reads the file of a sqlite: DATABASE_URL", () => {
    const file = (url: string) => detectConnection("/proj", () => ({ DATABASE_URL: url })).config.database;
    expect(file("sqlite:///var/data/app.sqlite")).toBe("/var/data/app.sqlite");
    expect(file("sqlite:app.sqlite")).toBe("app.sqlite");
    expect(file("sqlite:./data/app.sqlite")).toBe("./data/app.sqlite");
    expect(file("sqlite://data/app.sqlite")).toBe("data/app.sqlite");
  });

  it("lets a variable win over the DATABASE_URL file and names the variable that gave the file", () => {
    const { config, variables } = detectConnection("/proj", () => ({
      DATABASE_URL: "sqlite:///url.sqlite",
      SQLITE_DATABASE: "var.sqlite",
    }));
    expect(config.database).toBe("var.sqlite");
    expect(variables.database).toBe("SQLITE_DATABASE");
    expect(detectConnection("/proj", () => ({ DATABASE_URL: "sqlite:url.sqlite" })).variables.database).toBe(
      "DATABASE_URL",
    );
  });
});

/** Specification: openspec/specs/variant-config/core/spec.md (MariaDB detection) */
describe("detectConnection for MariaDB", () => {
  it("detects a mariadb:// URL as the mysql dialect and keeps the URL", () => {
    const { config } = detectConnection("/proj", () => ({ DATABASE_URL: "mariadb://app@localhost/app" }));

    expect(config).toMatchObject({ dialect: "mysql", url: "mariadb://app@localhost/app" });
  });

  it("reads MARIADB_ variables like their MYSQL_ counterparts", () => {
    const { config } = detectConnection("/proj", () => ({
      MARIADB_HOST: "maria.local",
      MARIADB_PORT: "3307",
      MARIADB_USER: "app",
      MARIADB_PASSWORD: "pw",
      MARIADB_DATABASE: "shop",
    }));

    expect(config).toMatchObject({
      dialect: "mysql",
      host: "maria.local",
      port: 3307,
      user: "app",
      password: "pw",
      database: "shop",
    });
  });

  it("lets a MYSQL_ variable win over the MARIADB_ one of the same setting", () => {
    const { config } = detectConnection("/proj", () => ({ MYSQL_HOST: "a", MARIADB_HOST: "b", MARIADB_USER: "u" }));

    expect(config).toMatchObject({ host: "a", user: "u" });
  });

  it("detects Postgres before MySQL and MariaDB, and those before SQLite", () => {
    expect(
      detectConnection("/proj", () => ({ POSTGRES_HOST: "p", MARIADB_HOST: "m", SQLITE_DATABASE: "s" })).config.dialect,
    ).toBe("postgres");
    expect(detectConnection("/proj", () => ({ MARIADB_HOST: "m", SQLITE_DATABASE: "s" })).config.dialect).toBe("mysql");
  });
});

/** Specification: openspec/specs/variant-api/init/spec.md (Secrets stay in the environment) */
describe("detectConnection variables", () => {
  it("names the variable that supplied each field", () => {
    const { variables } = detectConnection("/proj", () => ({
      DATABASE_URL: "postgres://localhost/app",
      POSTGRES_HOST: "h",
      POSTGRES_PORT: "5432",
      POSTGRES_USER: "u",
      POSTGRES_PASSWORD: "p",
      POSTGRES_DB: "d",
      POSTGRES_SCHEMA: "s",
      POSTGRES_SSL: "true",
    }));

    expect(variables).toEqual({
      url: "DATABASE_URL",
      host: "POSTGRES_HOST",
      port: "POSTGRES_PORT",
      user: "POSTGRES_USER",
      password: "POSTGRES_PASSWORD",
      database: "POSTGRES_DB",
      schema: "POSTGRES_SCHEMA",
      ssl: "POSTGRES_SSL",
    });
  });

  it("names the MariaDB and SQLite variables, and prefers MYSQL_ over MARIADB_", () => {
    expect(
      detectConnection("/proj", () => ({ MYSQL_HOST: "a", MARIADB_HOST: "b", MARIADB_PASSWORD: "p" })).variables,
    ).toEqual({ host: "MYSQL_HOST", password: "MARIADB_PASSWORD" });
    expect(detectConnection("/proj", () => ({ SQLITE_DATABASE: "a", SQLITE_PATH: "/x.db" })).variables).toEqual({
      database: "SQLITE_DATABASE",
    });
    expect(detectConnection("/proj", () => ({ SQLITE_PATH: "/x.db" })).variables).toEqual({ database: "SQLITE_PATH" });
  });

  it("names nothing when nothing is detected", () => {
    expect(detectConnection("/proj", () => ({})).variables).toEqual({});
  });
});

/** Specification: openspec/specs/variant-config/cfg-settings/spec.md (Branch naming settings) */
describe("detectDefaultBranch", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  const git = (cwd: string, ...args: string[]): string =>
    execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

  /** A repository whose first branch is `branch`, with one commit unless `commit` is false. */
  const repo = (branch: string, commit = true): string => {
    const root = realpathSync(mkdtempSync(join("/tmp", "variant-default-branch-")));
    roots.push(root);
    execFileSync("git", ["init", "-q", "-b", branch, root]);
    git(root, "config", "user.email", "variant@example.test");
    git(root, "config", "user.name", "Variant Tests");
    // AIDEV-NOTE: names a branch that never exists, so the machine's own global init.defaultBranch cannot decide a case.
    git(root, "config", "init.defaultBranch", "no-such-branch");
    if (commit) {
      git(root, "commit", "-q", "--allow-empty", "-m", "initial");
    }
    return root;
  };

  /** Points `origin/HEAD` at `origin/<branch>` the way a clone leaves it. */
  const originHead = (root: string, branch: string): void => {
    git(root, "remote", "add", "origin", "https://unreachable.invalid/project.git");
    git(root, "symbolic-ref", "refs/remotes/origin/HEAD", `refs/remotes/origin/${branch}`);
  };

  it("takes the branch origin/HEAD points at over a local main", () => {
    const root = repo("main");
    originHead(root, "develop");

    expect(detectDefaultBranch(root)).toEqual({ branch: "develop", via: "origin/HEAD" });
  });

  it("keeps a slash in the branch name of origin/HEAD", () => {
    const root = repo("main");
    originHead(root, "release/2");

    expect(detectDefaultBranch(root)?.branch).toBe("release/2");
  });

  it("takes the local branch master when there is no main, no remote and no setting", () => {
    const root = repo("master");

    expect(detectDefaultBranch(root)).toEqual({ branch: "master", via: "local branch" });
  });

  it("takes main before master", () => {
    const root = repo("master");
    git(root, "branch", "main");

    expect(detectDefaultBranch(root)).toEqual({ branch: "main", via: "local branch" });
  });

  it("takes init.defaultBranch when that local branch exists, before main", () => {
    const root = repo("main");
    git(root, "branch", "trunk");
    git(root, "config", "init.defaultBranch", "trunk");

    expect(detectDefaultBranch(root)).toEqual({ branch: "trunk", via: "init.defaultBranch" });
  });

  it("ignores init.defaultBranch when that local branch does not exist", () => {
    const root = repo("master");
    git(root, "config", "init.defaultBranch", "trunk");

    expect(detectDefaultBranch(root)).toEqual({ branch: "master", via: "local branch" });
  });

  it("falls back to the checked-out branch when no other signal exists", () => {
    const root = repo("develop");

    expect(detectDefaultBranch(root)).toEqual({ branch: "develop", via: "checked out" });
  });

  it("takes the unborn branch of a repository without commits", () => {
    const root = repo("trunk", false);

    expect(detectDefaultBranch(root)).toEqual({ branch: "trunk", via: "checked out" });
  });

  it("finds nothing outside a git repository", () => {
    const root = realpathSync(mkdtempSync(join("/tmp", "variant-default-branch-")));
    roots.push(root);

    expect(detectDefaultBranch(root)).toBeUndefined();
  });

  it("reads the default branch of a clone without contacting the remote", () => {
    const remote = repo("develop");
    const clone = realpathSync(mkdtempSync(join("/tmp", "variant-default-branch-")));
    roots.push(clone);
    execFileSync("git", ["clone", "-q", remote, clone]);
    git(clone, "checkout", "-q", "-b", "feat/work");
    git(clone, "remote", "set-url", "origin", "https://unreachable.invalid/project.git");

    expect(detectDefaultBranch(clone)).toEqual({ branch: "develop", via: "origin/HEAD" });
  });
});
