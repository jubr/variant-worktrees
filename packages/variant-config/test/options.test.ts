import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/index.js";
import { parseConfig } from "../src/parse.js";
import { VariantsConfigSchema } from "../src/schema.js";

const FILE = "variants.yaml";

/** Whether `variant` loads: an extra key only warns, every other violation fails. */
const variant = (value: unknown): boolean => {
  try {
    parseConfig(VariantsConfigSchema, { variant: value }, FILE);
    return true;
  } catch {
    return false;
  }
};
/** The warnings `variant` loads with, as key paths below `variant`. */
const warned = (value: unknown): string[] =>
  parseConfig(VariantsConfigSchema, { variant: value }, FILE).warnings.map((warning) =>
    warning.replace(`${FILE}: unknown key variant.`, ""),
  );
const issues = (value: unknown): string =>
  JSON.stringify(VariantsConfigSchema.safeParse({ variant: value }).error?.issues ?? []);

const withProject = (yaml: string, run: (directory: string) => void, files: string[] = []): void => {
  const directory = mkdtempSync(join("/tmp", "variant-options-"));
  try {
    writeFileSync(join(directory, "variants.yaml"), yaml);
    for (const file of files) {
      mkdirSync(join(directory, file), { recursive: true });
      writeFileSync(join(directory, file, "vite.config.ts"), "export default {};\n");
    }
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const loaded = (yaml: string, env: NodeJS.ProcessEnv = {}) => {
  let result: ReturnType<typeof loadConfig> | undefined;
  withProject(yaml, (directory) => {
    result = loadConfig({ cwd: directory, env });
  });
  return result as ReturnType<typeof loadConfig>;
};

describe("branch naming settings", () => {
  it("defaults to main and the feat/ and fix/ prefixes", () => {
    const { variant } = loaded("db:\n  dialect: sqlite\n");

    expect(variant.baseBranch).toBe("main");
    expect(variant.branchPrefixes).toEqual(["feat/", "fix/"]);
  });

  it("carries configured values", () => {
    const { variant } = loaded('variant:\n  baseBranch: develop\n  branchPrefixes: ["task/"]\n');

    expect(variant.baseBranch).toBe("develop");
    expect(variant.branchPrefixes).toEqual(["task/"]);
  });

  it("rejects prefixes that are empty or do not end in a slash, and an empty list", () => {
    expect(variant({ branchPrefixes: [""] })).toBe(false);
    expect(variant({ branchPrefixes: ["task"] })).toBe(false);
    expect(variant({ branchPrefixes: [] })).toBe(false);
    expect(variant({ baseBranch: "" })).toBe(false);
  });
});

describe("container engine and opening", () => {
  it("accepts docker and podman only", () => {
    expect(variant({ containerEngine: "podman" })).toBe(true);
    expect(variant({ containerEngine: "nerdctl" })).toBe(false);
  });

  it("opens URLs by default", () => {
    expect(loaded("db:\n  dialect: sqlite\n").variant.open).toBe(true);
  });

  it("does not open URLs when variant.open is false or VARIANT_OPEN is 0", () => {
    expect(loaded("variant:\n  open: false\n").variant.open).toBe(false);
    expect(loaded("variant:\n  open: true\n", { VARIANT_OPEN: "0" }).variant.open).toBe(false);
  });
});

describe("variant storage", () => {
  it("resolves defaults for an empty section", () => {
    expect(loaded("variant:\n  storage: {}\n").variant.storage).toEqual({
      dir: ".storage",
      envVarName: "STORAGE_ROOT",
    });
  });

  it("has no storage when absent", () => {
    expect(loaded("db:\n  dialect: sqlite\n").variant.storage).toBeUndefined();
  });

  it("rejects an absolute or escaping directory", () => {
    expect(variant({ storage: { dir: "../shared" } })).toBe(false);
    expect(variant({ storage: { dir: "/shared" } })).toBe(false);
    expect(variant({ storage: { dir: "data", envVarName: "APP_DATA" } })).toBe(true);
  });

  it("ignores the former env key with a warning", () => {
    expect(warned({ storage: { env: "APP_DATA" } })).toEqual(["storage.env"]);
  });
});

describe("provisioning steps", () => {
  const step = { name: "migrations", run: "bun run migrate", dir: "server", filterLinesRegex: "^Migration " };

  it("accepts steps and carries them unchanged", () => {
    expect(loaded("variant:\n  steps:\n    - name: migrations\n      run: bun run migrate\n").variant.steps).toEqual([
      { name: "migrations", run: "bun run migrate" },
    ]);
    expect(variant({ steps: [{ ...step, env: { A: "b" } }] })).toBe(true);
  });

  it("rejects duplicate names and names the duplicate", () => {
    expect(variant({ steps: [step, step] })).toBe(false);
    expect(issues({ steps: [step, step] })).toContain("migrations");
  });

  it("rejects names with other characters than letters, digits, - and _", () => {
    expect(variant({ steps: [{ ...step, name: "db-seed_2" }] })).toBe(true);
    expect(variant({ steps: [{ ...step, name: "run migrations" }] })).toBe(false);
    expect(variant({ steps: [{ ...step, name: "a.b" }] })).toBe(false);
  });

  it("rejects names that share an environment segment and names both", () => {
    const steps = [
      { ...step, name: "db-seed" },
      { ...step, name: "db_seed" },
    ];

    expect(variant({ steps })).toBe(false);
    expect(issues({ steps })).toContain("db-seed");
    expect(issues({ steps })).toContain("db_seed");
  });

  it("ignores the former show and unlessEnv keys with a warning each", () => {
    expect(warned({ steps: [{ name: "a", run: "b", show: "^x" }] })).toEqual(["steps.0.show"]);
    expect(warned({ steps: [{ name: "a", run: "b", unlessEnv: { SKIP: "true" } }] })).toEqual(["steps.0.unlessEnv"]);
  });

  it("rejects an invalid filterLinesRegex pattern and an escaping dir, and warns for an unknown key", () => {
    expect(variant({ steps: [{ ...step, filterLinesRegex: "(" }] })).toBe(false);
    expect(variant({ steps: [{ ...step, dir: ".." }] })).toBe(false);
    expect(variant({ steps: [{ ...step, dir: "/abs" }] })).toBe(false);
    expect(warned({ steps: [{ ...step, other: 1 }] })).toEqual(["steps.0.other"]);
  });
});

describe("supervision settings", () => {
  it("defaults to 2, 180 and 5", () => {
    expect(loaded("db:\n  dialect: sqlite\n").variant.supervise).toEqual({
      startDelaySeconds: 2,
      readyTimeoutSeconds: 180,
      checkoutPollSeconds: 5,
    });
  });

  it("merges partial settings with the defaults and rejects negative numbers", () => {
    expect(loaded("variant:\n  supervise:\n    checkoutPollSeconds: 0\n").variant.supervise).toEqual({
      startDelaySeconds: 2,
      readyTimeoutSeconds: 180,
      checkoutPollSeconds: 0,
    });
    expect(variant({ supervise: { startDelaySeconds: -1 } })).toBe(false);
  });
});

describe("implode settings", () => {
  it("defaults to empty lists, a merge gate and 200 diff lines", () => {
    expect(loaded("db:\n  dialect: sqlite\n").variant.implode).toEqual({
      preRm: [],
      discard: [],
      requireMerged: true,
      maxDiffLines: 200,
    });
  });

  it("carries configured lists", () => {
    const { implode } = loaded(
      'variant:\n  implode:\n    preRm: [dist, "openspec/changes/{{slug}}/pr*-demo.webm"]\n    discard: [bun.lock]\n    maxDiffLines: 10\n',
    ).variant;

    expect(implode.preRm).toEqual(["dist", "openspec/changes/{{slug}}/pr*-demo.webm"]);
    expect(implode.discard).toEqual(["bun.lock"]);
    expect(implode.maxDiffLines).toBe(10);
  });

  it("rejects preRm patterns that are absolute or climb out, and discard names with a path separator", () => {
    expect(variant({ implode: { preRm: ["a/b"] } })).toBe(true);
    expect(variant({ implode: { preRm: ["../outside"] } })).toBe(false);
    expect(variant({ implode: { preRm: ["a/../../b"] } })).toBe(false);
    expect(variant({ implode: { preRm: [".."] } })).toBe(false);
    expect(variant({ implode: { preRm: ["/tmp/x"] } })).toBe(false);
    expect(variant({ implode: { discard: ["a/b"] } })).toBe(false);
    expect(variant({ implode: { discard: [".."] } })).toBe(false);
    expect(variant({ implode: { maxDiffLines: -1 } })).toBe(false);
  });

  it("ignores the former untracked and restore keys with a warning each", () => {
    expect(warned({ implode: { untracked: ["x"], restore: ["bun.lock"] } }).sort()).toEqual([
      "implode.restore",
      "implode.untracked",
    ]);
  });
});

describe("port range", () => {
  it("defaults to 42000-42999", () => {
    expect(loaded("db:\n  dialect: sqlite\n").variant.ports).toEqual({ range: "42000-42999", low: 42000, high: 42999 });
  });

  it("carries a custom range", () => {
    expect(loaded('variant:\n  ports:\n    range: "50000-50099"\n').variant.ports).toEqual({
      range: "50000-50099",
      low: 50000,
      high: 50099,
    });
  });

  it("accepts a range of one port and the widest range", () => {
    expect(variant({ ports: { range: "50000-50000" } })).toBe(true);
    expect(variant({ ports: { range: "1024-65535" } })).toBe(true);
  });

  it.each([
    "42000",
    "42999-42000",
    "80-90",
    "abc",
    "42000-70000",
    "42000-",
    "-42999",
    " 42000-42999",
  ])("rejects the range %p", (range) => {
    expect(variant({ ports: { range } })).toBe(false);
  });

  it("ignores the former reservedPorts with a warning", () => {
    expect(warned({ reservedPorts: [3000] })).toEqual(["reservedPorts"]);
  });
});

describe("watches as a keyed record", () => {
  it("accepts a record and keeps the key order", () => {
    const { watches } = loaded(
      "variant:\n  watches:\n    fe:\n      kind: vite\n      dir: fe\n    be:\n      kind: nestjs\n      dir: be\n",
    ).variant;

    expect(Object.keys(watches)).toEqual(["fe", "be"]);
  });

  it("resolves the directory of a watch without dir to its key and keeps a given dir", () => {
    const { watches } = loaded(
      "variant:\n  watches:\n    fe:\n      kind: vite\n    be:\n      kind: nestjs\n      dir: server\n    my-api:\n      kind: nestjs\n",
    ).variant;

    expect(watches.fe?.dir).toBe("fe");
    expect(watches.be?.dir).toBe("server");
    expect(watches["my-api"]?.dir).toBe("my-api");
  });

  it("keeps the explicit dir of an autodetected watch", () => {
    withProject(
      "db:\n  dialect: sqlite\n",
      (directory) => {
        const { watches } = loadConfig({ cwd: directory }).variant;

        expect(Object.entries(watches).map(([key, watch]) => [key, watch.dir])).toEqual([["web", "a/web"]]);
      },
      ["a/web"],
    );
  });

  it("rejects a list and bad keys, and ignores a name setting with a warning", () => {
    expect(variant({ watches: [{ kind: "vite", dir: "fe" }] })).toBe(false);
    expect(warned({ watches: { api: { kind: "nestjs", dir: "be", name: "api" } } })).toEqual(["watches.api.name"]);
    expect(variant({ watches: { "1st": { kind: "vite", dir: "fe" } } })).toBe(false);
    expect(variant({ watches: { "a b": { kind: "vite", dir: "fe" } } })).toBe(false);
  });

  it("rejects keys that share an environment segment and names both", () => {
    const watches = { "my-api": { kind: "nestjs", dir: "a" }, my_api: { kind: "nestjs", dir: "b" } };

    expect(variant({ watches })).toBe(false);
    expect(issues({ watches })).toContain("my-api");
    expect(issues({ watches })).toContain("my_api");
  });

  it("autodetects keys from directory names, with numeric suffixes for repeats", () => {
    withProject(
      "db:\n  dialect: sqlite\n",
      (directory) => {
        expect(Object.keys(loadConfig({ cwd: directory }).variant.watches)).toEqual(["web", "web-2"]);
      },
      ["a/web", "b/web"],
    );
  });
});

describe("watch runtime options", () => {
  const watch = {
    kind: "nestjs",
    dir: "be",
    env: { sourceFile: ".env", overrides: { PORT: "{{port}}", PUBLIC_BASE_URL: "{{url}}" } },
    install: "bun install --frozen-lockfile",
    ready: "/api/health/live",
  };

  it("accepts the options", () => {
    expect(variant({ watches: { be: watch } })).toBe(true);
  });

  it("rejects a ready path without a leading slash", () => {
    expect(variant({ watches: { be: { ...watch, ready: "api/health" } } })).toBe(false);
  });
});

describe("watch container", () => {
  const be = { kind: "nestjs", dir: "be", container: { dockerfile: "be/Dockerfile", internalPort: 3000 } };
  const withContainer = (container: object) => ({ watches: { be: { ...be, container } } });

  it("accepts a Dockerfile with and without an internal port", () => {
    expect(variant(withContainer({ dockerfile: "fe/Dockerfile" }))).toBe(true);
    expect(variant(withContainer({ dockerfile: "be/Dockerfile", internalPort: 3000 }))).toBe(true);
  });

  it("carries the container unchanged", () => {
    const { watches } = loaded(
      "variant:\n  watches:\n    be:\n      kind: nestjs\n      dir: be\n      container:\n        dockerfile: be/Dockerfile\n",
    ).variant;

    expect(watches.be?.container).toEqual({ dockerfile: "be/Dockerfile" });
  });

  it("requires a Dockerfile and a valid internal port", () => {
    expect(variant(withContainer({ internalPort: 3000 }))).toBe(false);
    expect(variant(withContainer({ image: "app:latest" }))).toBe(false);
    expect(variant(withContainer({ dockerfile: "be/Dockerfile", internalPort: 0 }))).toBe(false);
    expect(variant(withContainer({ dockerfile: "be/Dockerfile", internalPort: 1.5 }))).toBe(false);
  });

  it.each([
    ["image", "app"],
    ["build", "bunx vite build"],
    ["static", "dist"],
    ["port", 3000],
    ["proxy", { path: "/api/", to: "be" }],
    ["volumes", ["a:b"]],
    ["env", { A: "b" }],
  ])("ignores the former container key %s with a warning", (key, value) => {
    expect(warned(withContainer({ dockerfile: "be/Dockerfile", [key]: value }))).toEqual([
      `watches.be.container.${key}`,
    ]);
  });

  it("keeps a wrong type as an error", () => {
    expect(variant(withContainer({ dockerfile: "be/Dockerfile", internalPort: "3000" }))).toBe(false);
  });
});

describe("variant-wide commands", () => {
  it("ignores variant.up and variant.watch with a warning and keeps variant.seed", () => {
    expect(warned({ up: "bun run dev", watch: "bun run watch" }).sort()).toEqual(["up", "watch"]);
    expect(warned({ seed: "bun run seed" })).toEqual([]);
  });
});
