/**
 * Specification: openspec/specs/docs/site/spec.md
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sentenceLines } from "./docs-sentences.ts";

const root = join(import.meta.dir, "..");

describe("sentenceLines", () => {
  test("puts two sentences that together reach 100 characters on two lines", () => {
    const first = `${"a".repeat(55)}.`;
    const second = `Then ${"b".repeat(55)}.`;
    expect(sentenceLines(`${first} ${second}\n`)).toBe(`${first}\n${second}\n`);
  });

  test("joins short sentences below 100 characters on one line", () => {
    expect(sentenceLines("One short one.\nAnother short one.\n")).toBe("One short one. Another short one.\n");
  });

  test("fills a line greedily and starts the next one when the next sentence does not fit", () => {
    const long = `X${"x".repeat(91)}.`;
    expect(sentenceLines(`Short. ${long} Tiny.\n`)).toBe(`Short.\n${long} Tiny.\n`);
  });

  test("does not split inside code, links, abbreviations or numbers", () => {
    const text =
      "Use `a. B` and [the x. Y page](./x.html#a.b), e.g. `Foo` and i.e. `Bar`, from Node.js 22.13 on, see https://a.b/c.d now.\n";
    expect(sentenceLines(text)).toBe(text);
  });

  test("splits before a sentence that starts with code or a link", () => {
    const a = `${"a".repeat(60)}.`;
    expect(sentenceLines(`${a} \`up\` is fine and long enough to stay on its own line here yes.\n`)).toBe(
      `${a}\n\`up\` is fine and long enough to stay on its own line here yes.\n`,
    );
  });

  test("keeps headings, tables, fenced code, containers, html and front matter as they are", () => {
    const text = [
      "---",
      "title: A. B. C.",
      "---",
      "",
      "# Heading. With two sentences.",
      "",
      "| a. B | c. D |",
      "| --- | --- |",
      "",
      "```bash",
      "echo one. Two.",
      "```",
      "",
      "::: info Title",
      "First sentence of the panel. Second sentence of the panel.",
      ":::",
      "",
      '<div class="x">Raw. Html.</div>',
      "",
    ].join("\n");
    expect(sentenceLines(text)).toBe(text);
  });

  test("re-wraps a paragraph that was wrapped by hand", () => {
    expect(sentenceLines("A short line\nthat goes on. Next one.\n")).toBe("A short line that goes on. Next one.\n");
  });

  test("keeps the list marker and indents continuation lines", () => {
    const one = `${"a".repeat(60)}.`;
    const two = `Then ${"b".repeat(60)}.`;
    expect(sentenceLines(`- ${one} ${two}\n- Short. Items.\n1. Numbered. Also.\n`)).toBe(
      `- ${one}\n  ${two}\n- Short. Items.\n1. Numbered. Also.\n`,
    );
  });

  test("is idempotent", () => {
    const text = "Some text. More text that is long enough to need its own line because it keeps going on and on.\n- Item. Two.\n";
    const once = sentenceLines(text);
    expect(sentenceLines(once)).toBe(once);
  });
});

describe("docs prose", () => {
  test("every Markdown file under docs/ puts sentences on lines as the rule says", () => {
    const listed = spawnSync("git", ["ls-files", "docs"], { cwd: root, encoding: "utf8" });
    const files = listed.stdout
      .split("\n")
      .filter((file) => file.endsWith(".md") && existsSync(join(root, file)));
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter((file) => {
      const text = readFileSync(join(root, file), "utf8");
      return sentenceLines(text) !== text;
    });
    expect(offenders).toEqual([]);
  });
});
