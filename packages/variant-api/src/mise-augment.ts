import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse } from "smol-toml";
import { miseSearchPlaces, type ResolveMiseOptions, resolveMiseBinary } from "variant-config";
import { MiseError, runMise } from "./mise.js";
import { gitRoot } from "./slug.js";

/**
 * Specification: openspec/specs/tools/mise/spec.md (Augmenting the Mise configuration)
 *
 * Makes the Mise configuration of a directory list this tool, the entry `mise use` would add, without installing
 * anything. Lines are inserted textually so that every other line of the file stays as it is.
 */

export const MISE_TOOL = "github:jubr/variant-worktrees";
const ENTRY_VALUE = "latest";

export interface AugmentMiseOptions {
  directory: string;
  /** The Mise executable the caller was given (the editor setting `variant.mise.binPath`). */
  miseBinPath?: string;
  /** Overrides where the executable is looked for; for tests. */
  search?: Pick<ResolveMiseOptions, "env" | "home" | "locations">;
}

export interface AugmentMiseResult {
  /** `created`: a new `mise.toml`; `added`: the entry went into an existing file; `unchanged`: already listed; `failed`: nothing changed. */
  status: "created" | "added" | "unchanged" | "failed";
  /** The file that changed, or in the other cases the file concerned. */
  file?: string;
  message: string;
}

const entryLine = `"${MISE_TOOL}" = "${ENTRY_VALUE}"`;

const checkoutRoot = (directory: string): string => {
  try {
    return realpathSync(gitRoot(directory));
  } catch {
    return realpathSync(directory);
  }
};

const inside = (root: string, path: string): boolean => path === root || path.startsWith(root + sep);

const real = (path: string): string | undefined => {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
};

/** The files of `mise config ls --json` inside the checkout without `.local.` names, closest first (Mise's order). */
const candidateFiles = (directory: string, run: { directory: string; binary: string }): string[] => {
  const output = runMise(run, ["config", "ls", "--json"]);
  let listed: unknown;
  try {
    listed = JSON.parse(output);
  } catch {
    throw new MiseError(directory, "mise config ls --json printed no valid JSON");
  }
  if (!Array.isArray(listed)) {
    throw new MiseError(directory, "mise config ls --json printed no list");
  }
  const root = checkoutRoot(directory);
  const files: string[] = [];
  for (const item of listed) {
    const path = typeof item === "object" && item !== null ? (item as { path?: unknown }).path : undefined;
    if (typeof path !== "string") {
      continue;
    }
    const absolute = path.startsWith("~/") ? join(homedir(), path.slice(2)) : resolve(directory, path);
    const resolved = real(absolute);
    if (resolved !== undefined && inside(root, resolved) && !basename(resolved).includes(".local.")) {
      files.push(resolved);
    }
  }
  return files;
};

const display = (directory: string, file: string): string => {
  const path = relative(directory, file);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path) ? path : file;
};

const tomlProblem = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const parseFile = (content: string): { tools?: unknown } => parse(content) as { tools?: unknown };

const HEADER = /^\s*\[\[?[A-Za-z0-9_."'\- ]+\]\]?\s*(?:#.*)?$/;
const TOOLS_HEADER = /^\s*\[\s*tools\s*\]\s*(?:#.*)?$/;
const TOOLS_SUBTABLE = /^\s*\[\s*tools\s*\./;

const lists = (parsed: { tools?: unknown }): boolean =>
  typeof parsed.tools === "object" && parsed.tools !== null && MISE_TOOL in parsed.tools;

/** The new content, or the reason the file cannot be extended in place. */
const withEntry = (content: string, parsed: { tools?: unknown }): { content: string } | { problem: string } => {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const header = lines.findIndex((line) => TOOLS_HEADER.test(line));
  if (header >= 0) {
    let end = lines.length;
    for (let index = header + 1; index < lines.length; index += 1) {
      if (HEADER.test(lines[index] as string)) {
        end = index;
        break;
      }
    }
    let last = end - 1;
    while (last > header && (lines[last] as string).trim() === "") {
      last -= 1;
    }
    lines.splice(last + 1, 0, entryLine);
    return { content: lines.join(eol) };
  }
  if (parsed.tools !== undefined && !lines.some((line) => TOOLS_SUBTABLE.test(line))) {
    return { problem: "tools is defined as an inline or dotted value, which cannot be extended in place" };
  }
  const body = content.endsWith("\n") || content === "" ? content : content + eol;
  const separator = body === "" || body.endsWith(`${eol}${eol}`) ? "" : eol;
  return { content: `${body}${separator}[tools]${eol}${entryLine}${eol}` };
};

const notFound = (options: AugmentMiseOptions): string => {
  const places = miseSearchPlaces(options.search);
  return [
    "Mise was not found.",
    `Searched: ${places.join(", ")}.`,
    "Set the editor setting or the configuration key variant.mise.binPath to the executable.",
  ].join(" ");
};

export const augmentMiseConfig = (options: AugmentMiseOptions): AugmentMiseResult => {
  const directory = resolve(options.directory);
  let binary: string | undefined;
  try {
    binary = resolveMiseBinary({ configured: options.miseBinPath, ...options.search });
  } catch (error) {
    return { status: "failed", message: tomlProblem(error) };
  }
  if (binary === undefined) {
    return { status: "failed", message: notFound(options) };
  }

  let files: string[];
  try {
    files = candidateFiles(directory, { directory, binary });
  } catch (error) {
    return { status: "failed", message: tomlProblem(error) };
  }

  const fallback = join(directory, "mise.toml");
  const target = files[0] ?? (existsSync(fallback) ? fallback : undefined);
  if (target === undefined) {
    writeFileSync(fallback, `[tools]\n${entryLine}\n`);
    return { status: "created", file: fallback, message: `created mise.toml with ${MISE_TOOL}` };
  }

  for (const file of new Set([...files, target])) {
    let parsed: { tools?: unknown };
    try {
      parsed = parseFile(readFileSync(file, "utf8"));
    } catch (error) {
      if (file !== target) {
        continue;
      }
      return {
        status: "failed",
        file,
        message: `${display(directory, file)} is not valid TOML and was left unchanged: ${tomlProblem(error)}`,
      };
    }
    if (lists(parsed)) {
      return {
        status: "unchanged",
        file,
        message: `${display(directory, file)} already lists ${MISE_TOOL}`,
      };
    }
  }

  const content = readFileSync(target, "utf8");
  const edited = withEntry(content, parseFile(content));
  if ("problem" in edited) {
    return {
      status: "failed",
      file: target,
      message: `${display(directory, target)} was left unchanged: ${edited.problem}`,
    };
  }
  try {
    if (!lists(parseFile(edited.content))) {
      throw new Error("the entry did not land in the tools table");
    }
  } catch (error) {
    return {
      status: "failed",
      file: target,
      message: `${display(directory, target)} was left unchanged: ${tomlProblem(error)}`,
    };
  }
  writeFileSync(target, edited.content);
  return { status: "added", file: target, message: `added ${MISE_TOOL} to ${display(directory, target)}` };
};
