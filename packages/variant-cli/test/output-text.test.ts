import { describe, expect, it } from "bun:test";
import { formatDuration } from "../src/duration.js";
import { renderOutput } from "../src/output.js";

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

  it("shows an implode with the removed worktree and the report", () => {
    const out = text("implode", {
      slug: "demo",
      removed: true,
      worktreeRemoved: true,
      worktree: "/work/_v-demo",
      report: "On branch feat/demo\nnothing to commit",
    });

    expect(out.split("\n")[0]).toBe("Imploded demo");
    expect(out).toContain("removed worktree /work/_v-demo");
    expect(out).toContain("nothing to commit");
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
    expect(out).toContain("password: ***");
    expect(out).not.toContain("hunter2");
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
  });
});
