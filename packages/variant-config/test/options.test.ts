import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/index.js";
import { VariantsConfigSchema } from "../src/schema.js";

const variant = (value: unknown): boolean => VariantsConfigSchema.safeParse({ variant: value }).success;
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

  it("rejects the former env key", () => {
    expect(variant({ storage: { env: "APP_DATA" } })).toBe(false);
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

  it("rejects the former show and unlessEnv keys", () => {
    expect(variant({ steps: [{ name: "a", run: "b", show: "^x" }] })).toBe(false);
    expect(variant({ steps: [{ name: "a", run: "b", unlessEnv: { SKIP: "true" } }] })).toBe(false);
  });

  it("rejects an invalid filterLinesRegex pattern, an escaping dir and unknown keys", () => {
    expect(variant({ steps: [{ ...step, filterLinesRegex: "(" }] })).toBe(false);
    expect(variant({ steps: [{ ...step, dir: ".." }] })).toBe(false);
    expect(variant({ steps: [{ ...step, dir: "/abs" }] })).toBe(false);
    expect(variant({ steps: [{ ...step, other: 1 }] })).toBe(false);
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

  it("rejects the former untracked and restore keys", () => {
    expect(variant({ implode: { untracked: ["x"] } })).toBe(false);
    expect(variant({ implode: { restore: ["bun.lock"] } })).toBe(false);
  });
});

describe("reserved ports", () => {
  it("defaults to 3000, 4200 and 5432 and accepts an empty list", () => {
    expect(loaded("db:\n  dialect: sqlite\n").variant.reservedPorts).toEqual([3000, 4200, 5432]);
    expect(loaded("variant:\n  reservedPorts: []\n").variant.reservedPorts).toEqual([]);
  });
});

describe("instances as a keyed record", () => {
  it("accepts a record and keeps the key order", () => {
    const { instances } = loaded(
      "variant:\n  instances:\n    fe:\n      kind: vite\n      dir: fe\n    be:\n      kind: nestjs\n      dir: be\n",
    ).variant;

    expect(Object.keys(instances)).toEqual(["fe", "be"]);
  });

  it("rejects a list, a name setting and bad keys", () => {
    expect(variant({ instances: [{ kind: "vite", dir: "fe" }] })).toBe(false);
    expect(variant({ instances: { api: { kind: "nestjs", dir: "be", name: "api" } } })).toBe(false);
    expect(variant({ instances: { "1st": { kind: "vite", dir: "fe" } } })).toBe(false);
    expect(variant({ instances: { "a b": { kind: "vite", dir: "fe" } } })).toBe(false);
  });

  it("rejects keys that share an environment segment and names both", () => {
    const instances = { "my-api": { kind: "nestjs", dir: "a" }, my_api: { kind: "nestjs", dir: "b" } };

    expect(variant({ instances })).toBe(false);
    expect(issues({ instances })).toContain("my-api");
    expect(issues({ instances })).toContain("my_api");
  });

  it("autodetects keys from directory names, with numeric suffixes for repeats", () => {
    withProject(
      "db:\n  dialect: sqlite\n",
      (directory) => {
        expect(Object.keys(loadConfig({ cwd: directory }).variant.instances)).toEqual(["web", "web-2"]);
      },
      ["a/web", "b/web"],
    );
  });
});

describe("instance runtime options", () => {
  const instance = {
    kind: "nestjs",
    dir: "be",
    env: { sourceFile: ".env", overrides: { PORT: "{{port}}", PUBLIC_BASE_URL: "{{url}}" } },
    install: "bun install --frozen-lockfile",
    ready: "/api/health/live",
  };

  it("accepts the options", () => {
    expect(variant({ instances: { be: instance } })).toBe(true);
  });

  it("rejects a ready path without a leading slash", () => {
    expect(variant({ instances: { be: { ...instance, ready: "api/health" } } })).toBe(false);
  });
});

describe("instance container", () => {
  const be = { kind: "nestjs", dir: "be", container: { dockerfile: "be/Dockerfile", internalPort: 3000 } };
  const withContainer = (container: object) => ({ instances: { be: { ...be, container } } });

  it("accepts a Dockerfile with and without an internal port", () => {
    expect(variant(withContainer({ dockerfile: "fe/Dockerfile" }))).toBe(true);
    expect(variant(withContainer({ dockerfile: "be/Dockerfile", internalPort: 3000 }))).toBe(true);
  });

  it("carries the container unchanged", () => {
    const { instances } = loaded(
      "variant:\n  instances:\n    be:\n      kind: nestjs\n      dir: be\n      container:\n        dockerfile: be/Dockerfile\n",
    ).variant;

    expect(instances.be?.container).toEqual({ dockerfile: "be/Dockerfile" });
  });

  it("requires a Dockerfile and a valid internal port", () => {
    expect(variant(withContainer({ internalPort: 3000 }))).toBe(false);
    expect(variant(withContainer({ image: "app:latest" }))).toBe(false);
    expect(variant(withContainer({ dockerfile: "be/Dockerfile", internalPort: 0 }))).toBe(false);
    expect(variant(withContainer({ dockerfile: "be/Dockerfile", internalPort: 1.5 }))).toBe(false);
  });

  it("rejects the former image, build, static, port, proxy, volumes and env keys", () => {
    const dockerfile = "be/Dockerfile";

    expect(variant(withContainer({ dockerfile, image: "app" }))).toBe(false);
    expect(variant(withContainer({ dockerfile, build: "bunx vite build" }))).toBe(false);
    expect(variant(withContainer({ dockerfile, static: "dist" }))).toBe(false);
    expect(variant(withContainer({ dockerfile, port: 3000 }))).toBe(false);
    expect(variant(withContainer({ dockerfile, proxy: { path: "/api/", to: "be" } }))).toBe(false);
    expect(variant(withContainer({ dockerfile, volumes: ["a:b"] }))).toBe(false);
    expect(variant(withContainer({ dockerfile, env: { A: "b" } }))).toBe(false);
  });
});

describe("variant-wide commands", () => {
  it("rejects variant.up and variant.watch and keeps variant.seed", () => {
    expect(variant({ up: "bun run dev" })).toBe(false);
    expect(variant({ watch: "bun run watch" })).toBe(false);
    expect(variant({ seed: "bun run seed" })).toBe(true);
  });
});
