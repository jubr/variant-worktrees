import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commands } from "variant-api/commands";
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

  it("lists every lifecycle command, then ui and completions", () => {
    expect(model.map((command) => command.name)).toEqual([
      ...commands.map((command) => String(command.name)),
      "ui",
      "completions",
    ]);
    expect(byName("completions").description).not.toBe("");
  });

  it("describes create with its slug flag and short alias", () => {
    const slug = byName("create").flags.find((flag) => flag.long === "slug");

    expect(slug).toMatchObject({ long: "slug", short: "s", takesValue: true });
    const from = byName("create").flags.find((flag) => flag.long === "from");
    expect(from).toMatchObject({ long: "from", takesValue: true });
    expect(from?.short).toBeUndefined();
    expect(byName("create").flags.map((flag) => flag.long)).toEqual([
      "slug",
      "from",
      "verbose",
      "json",
      "yaml",
      "log-level",
    ]);
  });

  it("describes the flags of watch, implode and list, with the output flags last", () => {
    expect(byName("watch").flags.map((flag) => flag.long)).toContain("detach");
    expect(byName("implode").flags.map((flag) => flag.long)).toContain("force");
    expect(byName("list").flags.map((flag) => flag.long)).toEqual(["verbose", "json", "yaml", "log-level"]);
    expect(byName("list").flags.find((flag) => flag.long === "json")?.takesValue).toBe(false);
  });

  it("describes the flags of init: prefix takes a value, the steps and force are switches", () => {
    const flags = byName("init").flags;

    expect(flags.map((flag) => flag.long)).toEqual([
      "prefix",
      "file",
      "gitignore",
      "mise",
      "force",
      "json",
      "yaml",
      "log-level",
    ]);
    expect(flags.find((flag) => flag.long === "prefix")?.takesValue).toBe(true);
    expect(flags.find((flag) => flag.long === "gitignore")?.takesValue).toBe(false);
    expect(byName("init").takesSlug).toBe(false);
  });

  it("describes ui with its two flags and no slug", () => {
    expect(byName("ui").flags.map((flag) => flag.long)).toEqual(["detach", "stop"]);
    expect(byName("ui").takesSlug).toBe(false);
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

  it("offers --detach for watch and ui only, and --stop for ui only", () => {
    expect(section(shell, script, "watch")).toContain(longFlag(shell, "detach"));
    expect(section(shell, script, "ui")).toContain(longFlag(shell, "detach"));
    expect(section(shell, script, "ui")).toContain(longFlag(shell, "stop"));
    for (const name of ["list", "create", "status", "completions"]) {
      expect(section(shell, script, name)).not.toContain(longFlag(shell, "detach"));
      expect(section(shell, script, name)).not.toContain(longFlag(shell, "stop"));
    }
  });

  it("offers --json and --yaml on every lifecycle subcommand, not on ui or completions", () => {
    for (const command of commands) {
      const part = section(shell, script, String(command.name));
      expect(part).toContain(longFlag(shell, "json"));
      expect(part).toContain(longFlag(shell, "yaml"));
      expect(part).toContain(longFlag(shell, "log-level"));
    }
    for (const name of ["ui", "completions"]) {
      expect(section(shell, script, name)).not.toContain(longFlag(shell, "json"));
      expect(section(shell, script, name)).not.toContain(longFlag(shell, "log-level"));
    }
  });

  it("does not offer the removed --table flag", () => {
    expect(script).not.toContain(longFlag(shell, "table"));
  });

  it("offers --verbose on every lifecycle subcommand", () => {
    // `init` bootstraps a project and has no verbose output.
    for (const command of commands.filter((definition) => definition.name !== "init")) {
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

describe.each(SHELLS)("%s completion script slug wiring", (shell) => {
  const script = generateCompletions(shell);
  const slugCommands = commands.filter((command) => command.args.some((arg) => arg.name === "slug"));
  const otherCommands = commands.filter((command) => !slugCommands.includes(command));

  /** What the section of a command holds when it completes slugs for `--slug`/`-s` and for the positional. */
  const wiring: Record<Shell, { flag: (part: string) => boolean; positional: (part: string) => boolean }> = {
    bash: {
      flag: (part) => part.includes("slug_flags='--slug -s'"),
      positional: (part) => part.includes("slug_pos=1"),
    },
    fish: {
      flag: (part) =>
        part.split("\n").some((line) => line.includes("-l slug") && line.includes("__variant_slug_candidates")),
      positional: (part) =>
        part.split("\n").some((line) => !line.includes("-l ") && line.includes("__variant_slug_candidates")),
    },
    zsh: {
      flag: (part) => part.includes(":slug:_variant_slugs"),
      positional: (part) => part.includes("'1:slug:_variant_slugs'"),
    },
  };

  it("completes slugs for --slug, -s and the positional of every slug-taking command", () => {
    for (const command of slugCommands) {
      const part = section(shell, script, String(command.name));
      expect(wiring[shell].flag(part)).toBe(true);
      expect(wiring[shell].positional(part)).toBe(true);
    }
  });

  it("offers no slugs to commands without a slug", () => {
    for (const command of otherCommands) {
      const part = section(shell, script, String(command.name));
      expect(part).not.toBe("");
      expect(wiring[shell].flag(part)).toBe(false);
      expect(wiring[shell].positional(part)).toBe(false);
    }
    expect(wiring[shell].positional(section(shell, script, "completions"))).toBe(false);
  });

  it("asks `variant completions --list-slugs` for the candidates, silencing its errors, and only there", () => {
    const asks = script.split("completions --list-slugs").length - 1;
    expect(asks).toBeGreaterThan(0);
    expect(script.split("command variant completions --list-slugs 2>/dev/null").length - 1).toBe(asks);
  });

  it("does not embed any slug in the script", () => {
    expect(script).not.toMatch(/add-auth|fix-login/);
  });
});

describe.each(SHELLS)("%s completion script slug memory", (shell) => {
  const script = generateCompletions(shell);

  it("remembers the slugs, their directory and their time in three variables", () => {
    for (const name of ["__variant_slugs", "__variant_dir", "__variant_time"]) {
      expect(script).toContain(name);
    }
  });

  it("compares the working directory and a 30 second age before using the list", () => {
    expect(script).toContain("$PWD");
    expect(script).toMatch(/\b30\b/);
    expect(script).toContain({ fish: "date +%s", bash: "$SECONDS", zsh: "$EPOCHSECONDS" }[shell]);
  });

  it("creates no file, directory, or universal variable", () => {
    for (const forbidden of ["mkdir", "mktemp", "touch", "set -U", "set --universal", "tee "]) {
      expect(script).not.toContain(forbidden);
    }
    // Redirections to a path: only `2>/dev/null` and descriptor duplication are allowed.
    const redirections = script
      .replaceAll("2>/dev/null", "")
      .replaceAll("->", "")
      .replace(/[0-9]?>&/g, "");
    expect(redirections).not.toMatch(/>\s*[^\s]/);
  });
});

describe("completion script prefetch", () => {
  it("zsh gathers through a descriptor on a process substitution that zle reads, then closes it", () => {
    const script = generateCompletions("zsh");

    expect(script).toMatch(/exec \{\w+\}< <\(command variant completions --list-slugs 2>\/dev\/null\)/);
    expect(script).toMatch(/zle -F \$\w+ \w+/);
    expect(script).toMatch(/zle -F \$\w+\s/);
    expect(script).toMatch(/exec \{\w+\}<&-/);
  });

  it("bash 4.1 or newer gathers through a descriptor and reads it once ready, guarded by BASH_VERSINFO", () => {
    const script = generateCompletions("bash");

    expect(script).toMatch(/exec \{\w+\}< <\(command variant completions --list-slugs 2>\/dev\/null\)/);
    expect(script).toMatch(/read -t 0 -u "\$\w+"/);
    expect(script).toMatch(/mapfile -t -u "\$\w+"/);
    expect(script).toMatch(/exec \{\w+\}<&-/);
    const guard = script.indexOf("BASH_VERSINFO");
    expect(guard).toBeGreaterThan(-1);
    expect(script).toMatch(
      /\$\{BASH_VERSINFO\[0\]\} -gt 4 \|\| \(\$\{BASH_VERSINFO\[0\]\} -eq 4 && \$\{BASH_VERSINFO\[1\]\} -ge 1\)/,
    );
  });

  it("fish starts no background work", () => {
    const script = generateCompletions("fish");

    expect(script).not.toContain("<(");
    expect(script).not.toMatch(/&\s*$/m);
    expect(script).not.toContain("--on-event");
    expect(script).not.toContain("disown");
  });

  it("bash decides at load time, without running variant, whether it may prefetch", () => {
    const script = generateCompletions("bash");

    expect(script).toContain("__variant_async=");
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
