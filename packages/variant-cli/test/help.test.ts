import { describe, expect, it } from "bun:test";
import { runCli } from "./support/cli.js";

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
