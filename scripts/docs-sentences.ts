/**
 * Specification: openspec/specs/docs/site/spec.md (Sentences are on separate lines)
 *
 * Puts each sentence of Markdown prose on a line of its own, which Markdown renders as one paragraph.
 * Consecutive sentences share a line while that line stays below 100 characters.
 *
 *   bun scripts/docs-sentences.ts           list the files that differ from the rule
 *   bun scripts/docs-sentences.ts --write   rewrite them
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_LINE = 100;
const ABBREVIATIONS = new Set(["e.g", "i.e", "vs", "cf", "etc"]);

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^\s{0,3}#{1,6}(\s|$)/;
const TABLE = /^\s*\|/;
const CONTAINER = /^\s*:::/;
const RAW_HTML = /^\s*<[A-Za-z!/]/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+/;

/** Spans that must not be split: links, inline code, autolinks, inline HTML and bare URLs. */
const PROTECTED = /\[[^\]]*\]\([^)]*\)|(`+)[\s\S]*?\1|<[^>\s][^>]*>|https?:\/\/[^\s)]+/g;

const splitSentences = (text: string): string[] => {
  const held: string[] = [];
  const masked = text.replace(PROTECTED, (span) => {
    held.push(span);
    return `\u0000${held.length - 1}\u0000`;
  });
  const sentences: string[] = [];
  let start = 0;
  const boundary = /[.!?]["')\]*_]*(\s+)(?=[A-Z\u0000[*_(])/g;
  for (let match = boundary.exec(masked); match !== null; match = boundary.exec(masked)) {
    const before = masked.slice(start, match.index);
    const word = /([A-Za-z.]+)$/.exec(before)?.[1]?.toLowerCase() ?? "";
    if (masked[match.index] === "." && ABBREVIATIONS.has(word)) continue;
    sentences.push(masked.slice(start, match.index + match[0].length - match[1].length));
    start = match.index + match[0].length;
  }
  sentences.push(masked.slice(start));
  return sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => sentence.replace(/\u0000(\d+)\u0000/g, (_, index: string) => held[Number(index)]));
};

const fill = (sentences: string[]): string[] => {
  const lines: string[] = [];
  for (const sentence of sentences) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + sentence.length < MAX_LINE) {
      lines[lines.length - 1] = `${last} ${sentence}`;
    } else {
      lines.push(sentence);
    }
  }
  return lines;
};

/** Rewrites the prose of a Markdown document: one sentence per line, short sentences sharing a line. */
export const sentenceLines = (markdown: string): string => {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let index = 0;

  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) {
      out.push(...lines.slice(0, end + 1));
      index = end + 1;
    }
  }

  let fence: string | undefined;
  let raw = false;
  let block: { first: string; rest: string; text: string[] } | undefined;

  const flush = () => {
    if (!block) return;
    const text = block.text.join(" ").replace(/\s+/g, " ").trim();
    const wrapped = fill(splitSentences(text));
    wrapped.forEach((line, position) => {
      out.push(`${position === 0 ? block?.first : block?.rest}${line}`);
    });
    block = undefined;
  };

  for (; index < lines.length; index++) {
    const line = lines[index];
    const fenced = FENCE.exec(line);
    if (fence !== undefined) {
      out.push(line);
      if (fenced && fenced[1] === fence) fence = undefined;
      continue;
    }
    if (fenced) {
      flush();
      fence = fenced[1];
      out.push(line);
      continue;
    }
    if (line.trim() === "") {
      flush();
      raw = false;
      out.push(line);
      continue;
    }
    if (raw) {
      out.push(line);
      continue;
    }
    if (RAW_HTML.test(line)) {
      flush();
      raw = true;
      out.push(line);
      continue;
    }
    if (HEADING.test(line) || TABLE.test(line) || CONTAINER.test(line) || RULE.test(line)) {
      flush();
      out.push(line);
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flush();
      block = { first: item[0], rest: " ".repeat(item[0].length), text: [line.slice(item[0].length)] };
      continue;
    }
    if (block) {
      block.text.push(line);
    } else {
      const indent = /^\s*/.exec(line)?.[0] ?? "";
      block = { first: indent, rest: indent, text: [line] };
    }
  }
  flush();
  return out.join("\n");
};

const root = join(import.meta.dir, "..");

/** The tracked Markdown files under docs/, without the generated API reference. */
export const docsMarkdown = (): string[] => {
  const listed = spawnSync("git", ["ls-files", "docs"], { cwd: root, encoding: "utf8" });
  return listed.stdout
    .split("\n")
    .filter((file) => file.endsWith(".md") && !file.startsWith("docs/api/") && existsSync(join(root, file)));
};

if (import.meta.main) {
  const write = process.argv.includes("--write");
  const differing = docsMarkdown().filter((file) => {
    const text = readFileSync(join(root, file), "utf8");
    const rewritten = sentenceLines(text);
    if (rewritten === text) return false;
    if (write) writeFileSync(join(root, file), rewritten);
    return true;
  });
  for (const file of differing) console.log(`${write ? "rewrote" : "differs"}: ${file}`);
  process.exit(differing.length > 0 && !write ? 1 : 0);
}
