import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { runCli } from "./test/cli.js";

/** The lines of one help section, from its title (`FLAGS:`) up to the next blank line. */
const section = (help: string, title: string): string[] => {
  const lines = help.split("\n");
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `${title.toLowerCase()}:`);
  if (start === -1) {
    return [];
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.trim() === "");
  return end === -1 ? rest : rest.slice(0, end);
};

describe("global flags in help", () => {
  it("lists them in their own section of the top-level help", async () => {
    const help = (await runCli(["--help"])).stdout;
    const globals = section(help, "Global flags").join("\n");

    expect(globals).toContain("--json");
    expect(globals).toContain("--yaml");
    expect(globals).toContain("--help");
    expect(globals).toContain("--version");
  });

  it("lists them apart from the flags of a command", async () => {
    const help = (await runCli(["watch", "--help"])).stdout;
    const flags = section(help, "Flags").join("\n");
    const globals = section(help, "Global flags").join("\n");

    expect(flags).toContain("--detach");
    expect(flags).toContain("--slug");
    expect(flags).not.toContain("--json");
    expect(flags).not.toContain("--yaml");
    expect(flags).not.toContain("--help");
    expect(globals).toContain("--json");
    expect(globals).toContain("--yaml");
    expect(globals).toContain("--help");
    expect(globals).not.toContain("--version");
  });

  it("puts the global flags section after the flags of the command", async () => {
    const help = (await runCli(["watch", "--help"])).stdout.toLowerCase();

    expect(help.indexOf("global flags:")).toBeGreaterThan(help.indexOf("flags:"));
  });

  it("still shows the global flags of a command that has no flags of its own", async () => {
    const help = (await runCli(["create", "--help"])).stdout;

    expect(section(help, "Global flags").join("\n")).toContain("--json");
  });
});

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Flag rows of the Global flags section, including any empty line between the first and the last. */
const globalFlagSpan = (help: string): string[] => {
  const lines = help.replaceAll("\r", "").replace(ANSI, "").split("\n");
  const heading = lines.findIndex((line) => line.trim().toLowerCase() === "global flags:");
  const body = lines.slice(heading + 1);
  const isFlag = (line: string): boolean => /(?:^|\s)(?:--(?:json|yaml|log-level|help|version)|-h,|-C)\b/.test(line);
  const indexes = body.flatMap((line, index) => (isFlag(line) ? [index] : []));
  const first = indexes[0];
  const last = indexes[indexes.length - 1];
  return first === undefined || last === undefined ? [] : body.slice(first, last + 1);
};

/** Help as a terminal of `cols` columns would print it. */
const helpOnTerminal = async (args: string[], cols: number): Promise<string> => {
  const chunks: Uint8Array[] = [];
  const { FORCE_COLOR: _color, ...inherited } = process.env;
  const terminal = new Bun.Terminal({
    cols,
    rows: 50,
    data(_term, data) {
      chunks.push(data);
    },
  });
  try {
    const proc = Bun.spawn(["bun", "run", join(import.meta.dir, "cli.ts"), ...args], {
      terminal,
      env: { ...inherited, NO_COLOR: "1", VARIANT_WORKTREE: "0" },
    });
    await proc.exited;
    await Bun.sleep(30);
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    terminal.close();
  }
};

describe("global flag spacing", () => {
  it("prints no empty line between global flags on a narrow terminal", async () => {
    const help = await helpOnTerminal(["config", "--help"], 60);
    const span = globalFlagSpan(help);

    expect(span.some((line) => line.includes("--json"))).toBe(true);
    expect(span.some((line) => line.includes("-C") && line.includes("<path>"))).toBe(true);
    expect(span.some((line) => line.trim() === "")).toBe(false);
  });

  it("prints no empty line between global flags on a wide terminal", async () => {
    const help = await helpOnTerminal(["config", "--help"], 120);
    const span = globalFlagSpan(help);

    expect(span.some((line) => line.includes("-C") && line.includes("<path>"))).toBe(true);
    expect(span.join("\n")).not.toContain("--chdir");
    expect(span.some((line) => line.trim() === "")).toBe(false);
  });

  it("lists -C <path> with no long option and no empty line between global flags", async () => {
    const help = (await runCli(["--help"])).stdout;
    const span = globalFlagSpan(help);
    const directory = span.find((line) => line.includes("-C"));

    expect(directory).toContain("<path>");
    expect(directory).not.toContain("--chdir");
    expect(span.some((line) => line.trim() === "")).toBe(false);
  });

  it("keeps command flags apart from -C on watch help", async () => {
    const help = (await runCli(["watch", "--help"])).stdout;
    const flags = section(help, "Flags").join("\n");
    const span = globalFlagSpan(help);

    expect(flags).toContain("--detach");
    expect(flags).toContain("--slug");
    expect(flags).not.toContain("--json");
    expect(span.some((line) => line.includes("--json"))).toBe(true);
    expect(span.some((line) => line.includes("-C") && line.includes("<path>"))).toBe(true);
    expect(span.join("\n")).not.toContain("--chdir");
    expect(span.some((line) => line.trim() === "")).toBe(false);
  });
});
