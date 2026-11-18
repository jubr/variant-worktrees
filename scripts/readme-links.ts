/**
 * Specification: openspec/specs/docs/readmes/spec.md (README links are absolute and verified)
 *
 * The READMEs are shown on GitHub, npm and the marketplace, where a relative link breaks.
 * This finds their links and rewrites repository-relative ones to absolute GitHub links.
 *
 *   bun scripts/readme-links.ts           list the relative links
 *   bun scripts/readme-links.ts --write   rewrite them
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";

export const READMES = ["README.md", "packages/variant-vscode/README.md", "packages/chat-renamer-vscode/README.md"];
export const SITE = "https://jubr.github.io/variant-worktrees/";
export const REPO = "https://github.com/jubr/variant-worktrees";
export const RAW = "https://raw.githubusercontent.com/jubr/variant-worktrees/main/";

const root = join(import.meta.dir, "..");

export interface ReadmeLink {
  url: string;
  line: number;
}

interface Match {
  url: string;
  index: number;
  length: number;
  image: boolean;
}

const FENCE = /^\s*(```|~~~)/;
const INLINE = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const DEFINITION = /^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+.*)?$/;
const AUTOLINK = /<(https?:\/\/[^>\s]+)>/g;
const HTML_ATTRIBUTE = /\s(?:href|src)="([^"]*)"/g;

/** The link targets of one line outside fenced code, in the order they appear. */
const matchesOf = (line: string): Match[] => {
  const found: Match[] = [];
  for (const match of line.matchAll(INLINE)) {
    const url = match[1];
    const start = (match.index ?? 0) + match[0].indexOf(url, match[0].indexOf("]("));
    found.push({ url, index: start, length: url.length, image: match[0].startsWith("!") });
  }
  const definition = DEFINITION.exec(line);
  if (definition) {
    found.push({ url: definition[1], index: line.indexOf(definition[1]), length: definition[1].length, image: false });
  }
  for (const match of line.matchAll(AUTOLINK)) {
    found.push({ url: match[1], index: (match.index ?? 0) + 1, length: match[1].length, image: false });
  }
  for (const match of line.matchAll(HTML_ATTRIBUTE)) {
    const image = /<img\b/i.test(line.slice(0, match.index));
    found.push({ url: match[1], index: (match.index ?? 0) + match[0].indexOf('"') + 1, length: match[1].length, image });
  }
  return found.sort((a, b) => a.index - b.index);
};

/** Every link, image and html reference of a Markdown text, outside fenced code and inline code. */
export const linksOf = (markdown: string): ReadmeLink[] => {
  const links: ReadmeLink[] = [];
  let fence: string | undefined;
  markdown.split("\n").forEach((line, index) => {
    const fenced = FENCE.exec(line);
    if (fence !== undefined) {
      if (fenced?.[1] === fence) fence = undefined;
      return;
    }
    if (fenced) {
      fence = fenced[1];
      return;
    }
    // AIDEV-NOTE: a code span holds example Markdown, not a link; blank it out with spaces so the offsets stay
    const visible = line.replace(/(?<!\\)(`+)[^`]*?\1(?!\()/g, (span) => " ".repeat(span.length));
    for (const match of matchesOf(visible)) links.push({ url: match.url, line: index + 1 });
  });
  return links;
};

export interface FileSystem {
  exists: (path: string) => boolean;
  isDirectory: (path: string) => boolean;
}

const realFs: FileSystem = {
  exists: (path) => existsSync(join(root, path)),
  isDirectory: (path) => existsSync(join(root, path)) && statSync(join(root, path)).isDirectory(),
};

/** Rewrites the links of a README to files and folders of this repository into absolute GitHub links. */
export const absolutize = (markdown: string, file: string, fs: FileSystem = realFs): string => {
  let fence: string | undefined;
  return markdown
    .split("\n")
    .map((line) => {
      const fenced = FENCE.exec(line);
      if (fence !== undefined) {
        if (fenced?.[1] === fence) fence = undefined;
        return line;
      }
      if (fenced) {
        fence = fenced[1];
        return line;
      }
      const visible = line.replace(/(?<!\\)(`+)[^`]*?\1(?!\()/g, (span) => " ".repeat(span.length));
      let result = line;
      for (const match of matchesOf(visible).reverse()) {
        if (/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(match.url)) continue;
        const [path, ...rest] = match.url.split("#");
        const resolved = posix.normalize(posix.join(posix.dirname(file.replace(/\\/g, "/")), path)).replace(/\/$/, "");
        if (resolved.startsWith("..") || !fs.exists(resolved)) continue;
        const fragment = rest.length > 0 ? `#${rest.join("#")}` : "";
        const target = match.image
          ? `${RAW}${resolved}`
          : `${REPO}/${fs.isDirectory(resolved) ? "tree" : "blob"}/main/${resolved}${fragment}`;
        result = `${result.slice(0, match.index)}${target}${result.slice(match.index + match.length)}`;
      }
      return result;
    })
    .join("\n");
};

if (import.meta.main) {
  const write = process.argv.includes("--write");
  let relative = 0;
  for (const file of READMES) {
    const text = readFileSync(join(root, file), "utf8");
    const rewritten = absolutize(text, file);
    if (rewritten !== text && write) writeFileSync(join(root, file), rewritten);
    for (const link of linksOf(write ? rewritten : text)) {
      if (!/^https:\/\//.test(link.url)) {
        relative++;
        console.log(`${file}:${link.line} ${link.url}`);
      }
    }
  }
  process.exit(relative > 0 ? 1 : 0);
}
