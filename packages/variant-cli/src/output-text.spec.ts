import { describe, expect, it } from "bun:test";
import { parse as parseYaml } from "yaml";
import { formatDuration } from "./duration.js";
import { renderOutput, stdoutColor } from "./output.js";

const text = (command: string, result: unknown): string =>
  renderOutput(command, result, { format: "text", variantRoot: "/work" });

describe("text output of each command", () => {
  it("shows a created variant with its slug, target and worktree", () => {
    const out = text("create", {
      slug: "demo",
      target: "v_demo",
      dialect: "postgres",
      statePath: "/work/.cache/variants/demo.yaml",
      worktree: "/work/_v-demo",
      createdAt: "2026-11-01T10:00:00.000Z",
      exists: true,
    });

    expect(out.split("\n")[0]).toBe("Created demo");
    expect(out).toMatch(/target:\s+v_demo/);
    expect(out).toMatch(/worktree:\s+\/work\/_v-demo/);
  });

  it("shows what provision ran", () => {
    const out = text("provision", {
      slug: "demo",
      commands: ["bun install", "bun run db:seed"],
      output: "seeded 3 rows\n",
    });

    expect(out.split("\n")[0]).toBe("Provisioned demo");
    expect(out).toContain("+ bun run db:seed");
    expect(out).toContain("seeded 3 rows");
  });

  it("shows the watches of an up with their ports and containers", () => {
    const out = text("up", {
      slug: "demo",
      mode: "up",
      worktree: "/work/_v-demo",
      target: "v_demo",
      watches: { fe: { port: 62060, url: "http://demo.vw.localhost:62060/", container: "v-fe-demo" } },
      containers: [{ key: "fe", name: "v-fe-demo", port: 62060 }],
      urls: { fe: "http://demo.vw.localhost:62060/" },
      commands: [],
      output: "",
    });

    expect(out.split("\n")[0]).toBe("Started demo (up)");
    expect(out).toMatch(/fe\s+port 62060\s+http:\/\/demo\.vw\.localhost:62060\//);
    expect(out).toContain("v-fe-demo");
  });

  it("shows the processes of a watch with their pids and a non-zero exit code", () => {
    const out = text("watch", {
      slug: "demo",
      mode: "watch",
      worktree: "/work/_v-demo",
      target: "v_demo",
      watches: { be: { port: 62061, pid: 4242 } },
      processes: [{ key: "be", pid: 4242, command: "bun run dev" }],
      urls: {},
      exitCode: 1,
      commands: ["bun run dev"],
      output: "",
    });

    expect(out.split("\n")[0]).toBe("Started demo (watch)");
    expect(out).toMatch(/be\s+pid 4242\s+bun run dev/);
    expect(out).toMatch(/exit code:\s+1/);
  });

  it("shows what down stopped", () => {
    const out = text("down", {
      slug: "demo",
      processes: [{ key: "fe", pid: 77 }],
      containers: ["v-be-demo"],
      networks: ["v-net-demo"],
    });

    expect(out.split("\n")[0]).toBe("Stopped demo: 1 process, 1 container, 1 network");
    expect(out).toMatch(/fe\s+pid 77/);
    expect(out).toContain("v-be-demo");
    expect(out).toContain("v-net-demo");
  });

  it("shows an implode with the removed worktree and does not repeat the report", () => {
    const out = text("implode", {
      slug: "demo",
      removed: true,
      worktreeRemoved: true,
      worktree: "/work/_v-demo",
      report: "On branch feat/demo\nnothing to commit",
    });

    expect(out.split("\n")[0]).toBe("Imploded demo");
    expect(out).toContain("removed worktree /work/_v-demo");
    expect(out).not.toContain("removed branch");
    expect(out).not.toContain("nothing to commit");
  });

  it("names a removed branch and skips the line when the branch was kept", () => {
    const removed = text("implode", {
      slug: "demo",
      removed: true,
      worktreeRemoved: true,
      worktree: "/work/_v-demo",
      branch: "feat/demo",
      branchRemoved: true,
    });
    const kept = text("implode", {
      slug: "demo",
      removed: true,
      worktreeRemoved: true,
      worktree: "/work/_v-demo",
      branch: "feat/demo",
      branchRemoved: false,
    });

    expect(removed).toContain("removed branch feat/demo");
    expect(kept).not.toContain("removed branch");
  });

  it("says when an implode found nothing", () => {
    expect(text("implode", { slug: "ghost", removed: false, worktreeRemoved: false })).toBe(
      "Nothing to implode for ghost",
    );
  });

  it("shows config as an outline without the password", () => {
    const out = text("config", { db: { dialect: "postgres", password: "hunter2" }, variant: { prefix: "_v-" } });

    expect(out).toContain("dialect: postgres");
    expect(out).toContain("prefix: _v-");
    expect(out).not.toContain("hunter2");
  });

  it("prints an empty list as YAML", () => {
    const out = text("config", { warnings: [] });

    expect(parseYaml(out)).toEqual({ warnings: [] });
  });

  it("prints null as YAML", () => {
    const out = text("config", { db: { url: null, filename: null, ssl: null }, tags: [null] });

    expect(parseYaml(out)).toEqual({ db: { url: null, filename: null, ssl: null }, tags: [null] });
  });

  it("prints a redacted password as YAML", () => {
    const out = text("config", { db: { password: "hunter2" } });

    expect(parseYaml(out)).toEqual({ db: { password: "***" } });
  });

  it("falls back to an outline for a command without a layout", () => {
    expect(text("future", { a: 1, nested: { b: [1, 2] } })).toBe("a: 1\nnested:\n  b:\n    - 1\n    - 2");
  });
});

describe("duration text", () => {
  it("shows the two largest units that are not zero", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(90)).toBe("1m 30s");
    expect(formatDuration(300)).toBe("5m");
    expect(formatDuration(7500)).toBe("2h 5m");
    expect(formatDuration(3 * 86400 + 3600 + 59)).toBe("3d 1h");
  });
});

describe("status text", () => {
  const status = {
    slug: "demo",
    target: "v_demo",
    dialect: "postgres",
    statePath: "",
    worktree: "/work/_v-demo",
    createdAt: "",
    exists: true,
    mode: "watch",
    url: "http://demo.vw.localhost:62060/",
    uptimeSeconds: 7500,
    log: "/work/_v-demo/variants.watch.log",
    watches: {
      fe: { port: 62060, pid: 123, url: "http://demo.vw.localhost:62060/", alive: true, uptimeSeconds: 7500 },
      be: { port: 62061, pid: 456, alive: false },
    },
    runtime: {
      file: "/work/_v-demo/variants.local.yaml",
      slug: "demo",
      mode: "watch",
      dir: "/work/_v-demo",
      log: "/work/_v-demo/variants.watch.log",
      db: { dialect: "postgres", host: "db.example", schema: "v_demo", password: "hunter2" },
    },
  };

  it("starts with the slug and lists the facts of the variant", () => {
    const out = text("status", status);

    expect(out.split("\n")[0]).toBe("demo");
    expect(out).toMatch(/target:\s+v_demo/);
    expect(out).toMatch(/mode:\s+watch/);
    expect(out).toMatch(/uptime:\s+2h 5m/);
    expect(out).toMatch(/url:\s+http:\/\/demo\.vw\.localhost:62060\//);
    expect(out).toMatch(/log:\s+\/work\/_v-demo\/variants\.watch\.log/);
  });

  it("shows each watch with its port, pid, liveness and uptime", () => {
    const out = text("status", status);

    expect(out).toMatch(/fe\s+port 62060\s+pid 123 alive\s+up 2h 5m\s+http:\/\/demo\.vw\.localhost:62060\//);
    expect(out).toMatch(/be\s+port 62061\s+pid 456 dead/);
  });

  it("shows the runtime meta information without the password", () => {
    const out = text("status", status);

    expect(out).toContain("runtime:");
    expect(out).toContain("file: /work/_v-demo/variants.local.yaml");
    expect(out).toContain("schema: v_demo");
    expect(out).toContain('password: "***"');
    expect(out).not.toContain("hunter2");
  });

  it("prints the schemas of a multi variant", () => {
    const out = text("status", {
      slug: "demo",
      target: "v_demo",
      dialect: "postgres",
      statePath: "",
      createdAt: "",
      exists: true,
      schemas: ["v_demo-east", "v_demo-west"],
    });

    expect(out).toContain("schemas:");
    expect(out).toContain("v_demo-east");
    expect(out).toContain("v_demo-west");
  });

  it("leaves out what a variant without a runtime state does not have", () => {
    const out = text("status", {
      slug: "orphan",
      target: "v_orphan",
      dialect: "sqlite",
      statePath: "",
      createdAt: "",
      exists: true,
    });

    expect(out).toContain("orphan");
    expect(out).not.toContain("runtime:");
    expect(out).not.toContain("uptime");
    expect(out).not.toContain("schemas:");
  });
});

describe("list text", () => {
  const records = [
    {
      slug: "demo",
      target: "v_demo",
      dialect: "postgres",
      statePath: "",
      createdAt: "",
      exists: true,
      implodeClean: true,
      schemas: ["v_demo-east", "v_demo-west", "v_demo-north"],
    },
  ];

  it("keeps one row per variant", () => {
    const table = renderOutput("list", records, { format: "text", variantRoot: "/work" });

    expect(table.split("\n")).toHaveLength(2);
    expect(table).not.toContain("v_demo-east");
  });

  it("prints the schemas when verbose", () => {
    const verbose = renderOutput("list", records, { format: "text", variantRoot: "/work", verbose: true });

    expect(verbose).toContain("v_demo-east");
    expect(verbose).toContain("v_demo-north");
  });

  it("carries schemas in JSON and YAML", () => {
    const json = renderOutput("list", records, { format: "json", variantRoot: "/work" });
    const yaml = renderOutput("list", records, { format: "yaml", variantRoot: "/work" });

    expect(JSON.parse(json)[0].schemas).toEqual(["v_demo-east", "v_demo-west", "v_demo-north"]);
    expect(parseYaml(yaml)[0].schemas).toEqual(["v_demo-east", "v_demo-west", "v_demo-north"]);
  });
});

const ESC = "\u001b";
const cyan = (value: string): string => `${ESC}[36m${value}${ESC}[0m`;
const green = (value: string): string => `${ESC}[32m${value}${ESC}[0m`;
const magenta = (value: string): string => `${ESC}[95m${value}${ESC}[0m`;
const gray = (value: string): string => `${ESC}[90m${value}${ESC}[0m`;

const coloredConfig = (): object => {
  const value = {
    name: "#tag",
    count: 2,
    open: true,
    url: null,
    tags: [] as unknown[],
    extra: {},
    items: [1],
  };
  Object.defineProperty(value, "origins", {
    enumerable: false,
    value: {
      name: "# from ./variants.yaml",
      count: "# default",
      open: "# default",
      url: "# autodetect connection",
      tags: "# default",
      extra: "# default",
      items: "# default",
      "items.0": "# default",
    },
  });
  return value;
};

describe("config text color", () => {
  const plain = [
    'name: "#tag" # from ./variants.yaml',
    "count: 2 # default",
    "open: true # default",
    "url: null # autodetect connection",
    "tags: [] # default",
    "extra: {} # default",
    "items: # default",
    "  - 1",
  ].join("\n");

  it("colors keys, strings, numbers, booleans, and comments the way yq does", () => {
    const out = renderOutput("config", coloredConfig(), { format: "text", variantRoot: "/work", color: true });

    expect(out).toBe(
      [
        `${cyan("name")}: ${green('"#tag"')} ${gray("# from ./variants.yaml")}`,
        `${cyan("count")}: ${magenta("2")} ${gray("# default")}`,
        `${cyan("open")}: ${magenta("true")} ${gray("# default")}`,
        `${cyan("url")}: null ${gray("# autodetect connection")}`,
        `${cyan("tags")}: [] ${gray("# default")}`,
        `${cyan("extra")}: {} ${gray("# default")}`,
        `${cyan("items")}: ${gray("# default")}`,
        `  - ${magenta("1")}`,
      ].join("\n"),
    );
  });

  it("prints the same characters with no ESC when color is off", () => {
    const out = renderOutput("config", coloredConfig(), { format: "text", variantRoot: "/work", color: false });

    expect(out).toBe(plain);
    expect(out).not.toContain(ESC);
  });

  it("leaves --json and --yaml uncolored", () => {
    const options = { variantRoot: "/work", color: true } as const;
    expect(renderOutput("config", coloredConfig(), { ...options, format: "json" })).not.toContain(ESC);
    expect(renderOutput("config", coloredConfig(), { ...options, format: "yaml" })).not.toContain(ESC);
  });

  it("turns color on only for a terminal with NO_COLOR unset", () => {
    expect(stdoutColor({ isTTY: true }, {})).toBe(true);
    expect(stdoutColor({ isTTY: false }, {})).toBe(false);
    expect(stdoutColor({ isTTY: true }, { NO_COLOR: "1" })).toBe(false);
    expect(stdoutColor({ isTTY: true }, { NO_COLOR: "" })).toBe(false);
  });
});
