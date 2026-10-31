import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commands } from "../src/commands.js";
import { type CommandModel, describeCli, generateCompletions, SHELLS, type Shell } from "../src/completions.js";

/** The part of a script that completes one subcommand, in the layout of each generator. */
const section = (shell: Shell, script: string, name: string): string => {
  const lines = script.split("\n");
  if (shell === "bash") {
    return lines.find((line) => line.startsWith(`    ${name})`)) ?? "";
  }
  if (shell === "fish") {
    return lines.filter((line) => line.includes(`__fish_seen_subcommand_from ${name}'`)).join("\n");
  }
  const start = lines.findIndex((line) => line.startsWith(`        (${name})`));
  if (start === -1) {
    return "";
  }
  const end = lines.findIndex((line, index) => index > start && line.trim().endsWith(";;"));
  return lines.slice(start, end + 1).join("\n");
};

/** The part of a script that completes the subcommand names and the flags of `variant` itself. */
const topLevel = (shell: Shell, script: string): string => {
  const lines = script.split("\n");
  if (shell === "bash") {
    return lines.filter((line) => line.includes("--version")).join("\n");
  }
  if (shell === "fish") {
    return lines.filter((line) => line.includes("__fish_use_subcommand")).join("\n");
  }
  const start = script.indexOf("_arguments -C");
  return script.slice(start, script.indexOf("case $state", start));
};

/** How a script spells a long flag and a short alias. */
const longFlag = (shell: Shell, name: string): string => (shell === "fish" ? `-l ${name}` : `--${name}`);
const shortFlag = (shell: Shell, name: string): string => (shell === "fish" ? `-s ${name}` : `-${name}`);

describe("describeCli", () => {
  const model = describeCli();
  const byName = (name: string): CommandModel => {
    const found = model.find((command) => command.name === name);
    if (!found) {
      throw new Error(`no ${name} in the model`);
    }
    return found;
  };

  it("lists every lifecycle command and completions itself", () => {
    expect(model.map((command) => command.name)).toEqual([
      ...commands.map((command) => String(command.name)),
      "completions",
    ]);
    expect(byName("completions").description).not.toBe("");
  });

  it("describes create with its slug flag and short alias", () => {
    const slug = byName("create").flags.find((flag) => flag.long === "slug");

    expect(slug).toMatchObject({ long: "slug", short: "s", takesValue: true });
    expect(byName("create").flags.map((flag) => flag.long)).toEqual(["slug", "verbose"]);
  });

  it("describes the flags of watch, implode and list", () => {
    expect(byName("watch").flags.map((flag) => flag.long)).toContain("detach");
    expect(byName("implode").flags.map((flag) => flag.long)).toContain("force");
    expect(byName("list").flags.map((flag) => flag.long)).toEqual(["verbose", "table"]);
    expect(byName("list").flags.find((flag) => flag.long === "table")?.takesValue).toBe(false);
  });
});

describe.each(SHELLS)("%s completion script", (shell) => {
  const script = generateCompletions(shell);

  it("offers every subcommand and completions itself", () => {
    for (const command of commands) {
      expect(script).toContain(String(command.name));
    }
    expect(script).toContain("completions");
  });

  it("offers every flag with its short alias on the subcommand that takes it", () => {
    for (const command of commands) {
      const part = section(shell, script, String(command.name));
      expect(part).not.toBe("");
      for (const arg of command.args) {
        expect(part).toContain(longFlag(shell, arg.name));
        if (arg.short) {
          expect(part).toContain(shortFlag(shell, arg.short));
        }
      }
    }
  });

  it("offers --table for list only, and --detach for watch only", () => {
    expect(section(shell, script, "list")).toContain(longFlag(shell, "table"));
    expect(section(shell, script, "create")).not.toContain(longFlag(shell, "table"));
    expect(section(shell, script, "watch")).toContain(longFlag(shell, "detach"));
    expect(section(shell, script, "list")).not.toContain(longFlag(shell, "detach"));
    expect(section(shell, script, "create")).not.toContain(longFlag(shell, "detach"));
  });

  it("offers --verbose on every lifecycle subcommand", () => {
    for (const command of commands) {
      expect(section(shell, script, String(command.name))).toContain(longFlag(shell, "verbose"));
    }
  });

  it("offers --help and --version for variant itself", () => {
    const part = topLevel(shell, script);
    expect(part).toContain(longFlag(shell, "help"));
    expect(part).toContain(longFlag(shell, "version"));
  });

  it("offers the shell names after completions", () => {
    const part = section(shell, script, "completions");
    for (const name of SHELLS) {
      expect(part).toContain(name);
    }
  });

  it("completes a command added to the model without any other change", () => {
    const extended: CommandModel[] = [
      ...describeCli(),
      {
        name: "frobnicate",
        description: "Frobnicate a variant",
        takesSlug: false,
        flags: [{ long: "twice", short: "t", description: "Do it twice", takesValue: false }],
      },
    ];
    const generated = generateCompletions(shell, extended);

    expect(generated).toContain("frobnicate");
    expect(section(shell, generated, "frobnicate")).toContain(longFlag(shell, "twice"));
    expect(section(shell, generated, "frobnicate")).toContain(shortFlag(shell, "t"));
  });
});

describe.each(SHELLS)("%s completion script escaping", (shell) => {
  const nasty = "it's a: $HOME `id`";
  const model: CommandModel[] = [
    {
      name: "tricky",
      description: nasty,
      takesSlug: false,
      flags: [{ long: "odd", description: nasty, takesValue: false }],
    },
  ];
  const script = generateCompletions(shell, model);

  const syntaxCheck: Record<Shell, string[]> = {
    bash: ["bash", "-n"],
    zsh: ["zsh", "-n"],
    fish: ["fish", "--no-execute"],
  };

  it.skipIf(Bun.which(syntaxCheck[shell][0] as string) === null)(
    "parses in the real shell with quotes, colons, dollars and backticks in descriptions",
    () => {
      const directory = mkdtempSync(join(tmpdir(), "variant-escape-"));
      try {
        const file = join(directory, "script");
        writeFileSync(file, script);
        const [binary, ...flags] = syntaxCheck[shell];
        const result = Bun.spawnSync([binary as string, ...flags, file]);

        expect(result.stderr.toString()).toBe("");
        expect(result.exitCode).toBe(0);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it("never leaves a description's dollar or backtick open to expansion", () => {
    if (shell === "bash") {
      expect(script).not.toContain("$HOME `id`");
      return;
    }
    const escaped = shell === "fish" ? "it\\'s a: $HOME `id`" : "it'\\''s a: $HOME `id`";
    expect(script).toContain(escaped);
  });
});

describe.each(SHELLS)("%s completion script loading", (shell) => {
  /** Sources the script in the real shell and registers a probe; `variant` is a stub that records any start. */
  const load = (): { stdout: string; stderr: string; exitCode: number; started: boolean } => {
    const directory = mkdtempSync(join(tmpdir(), "variant-load-"));
    try {
      const bin = join(directory, "bin");
      mkdirSync(bin);
      const marker = join(directory, "started");
      writeFileSync(join(bin, "variant"), `#!/bin/sh\ntouch ${marker}\n`, { mode: 0o755 });
      const script = join(directory, "script");
      writeFileSync(script, generateCompletions(shell));
      const probe: Record<Shell, string[]> = {
        bash: ["bash", "--norc", "--noprofile", "-c", `source ${script}; complete -p variant >&2`],
        fish: ["fish", "--no-config", "-c", `source ${script}; complete -c variant | head -n 1 >&2`],
        zsh: [
          "zsh",
          "-f",
          "-c",
          `autoload -Uz compinit; compinit -u -d ${directory}/zcompdump; eval "$(cat ${script})"; print -u2 -r -- $_comps[variant]`,
        ],
      };
      // A bare PATH and a private HOME keep the user's shell setup (and mise shims) out of the probe.
      const [binary, ...rest] = probe[shell];
      const result = Bun.spawnSync([Bun.which(binary as string) as string, ...rest], {
        env: { PATH: `${bin}:/usr/bin:/bin`, HOME: directory, TERM: "dumb" },
      });
      return {
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
        exitCode: result.exitCode,
        started: existsSync(marker),
      };
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };

  it.skipIf(Bun.which(shell) === null)("registers a completion for variant and runs nothing", () => {
    const result = load();

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(shell === "fish" ? "complete variant" : "_variant");
    expect(result.started).toBe(false);
  });
});
