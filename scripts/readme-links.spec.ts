/**
 * Specification: openspec/specs/docs/readmes/spec.md
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { absolutize, linksOf, READMES, REPO, SITE } from "./readme-links.ts";

const root = join(import.meta.dir, "..");
const fakeFs = {
  exists: (path: string) => ["example", "example/README.md", "CONTRIBUTING.md", "packages/variant-vscode/media/icon-256.png"].includes(path),
  isDirectory: (path: string) => path === "example",
};

describe("linksOf", () => {
  test("finds links, images, reference definitions, autolinks and html attributes, with their line", () => {
    const text = [
      "A [link](./a.md) and ![image](./b.png \"title\").",
      "",
      "[ref]: https://x.test/ref",
      "<https://x.test/auto> and <a href=\"../c\">c</a> <img src=\"d.png\">",
    ].join("\n");
    expect(linksOf(text)).toEqual([
      { url: "./a.md", line: 1 },
      { url: "./b.png", line: 1 },
      { url: "https://x.test/ref", line: 3 },
      { url: "https://x.test/auto", line: 4 },
      { url: "../c", line: 4 },
      { url: "d.png", line: 4 },
    ]);
  });

  test("ignores fenced code and inline code", () => {
    const text = "Use `[a](./b)` here.\n\n```md\n[c](./d)\n```\n";
    expect(linksOf(text)).toEqual([]);
  });
});

describe("absolutize", () => {
  test("turns repository paths into GitHub links: directories to tree, files to blob", () => {
    const text = "See [`example/`](./example) and [its readme](./example/README.md#seed) and [contributing](CONTRIBUTING.md).\n";
    expect(absolutize(text, "README.md", fakeFs)).toBe(
      `See [\`example/\`](${REPO}/tree/main/example) and [its readme](${REPO}/blob/main/example/README.md#seed) and [contributing](${REPO}/blob/main/CONTRIBUTING.md).\n`,
    );
  });

  test("resolves against the folder of the README and turns images into raw links", () => {
    expect(absolutize("![i](./media/icon-256.png)\n", "packages/variant-vscode/README.md", fakeFs)).toBe(
      "![i](https://raw.githubusercontent.com/jubr/variant-worktrees/main/packages/variant-vscode/media/icon-256.png)\n",
    );
  });

  test("leaves absolute links, fragments-only links, missing targets and code alone", () => {
    const text = `[a](${SITE}guide/core#init) [b](#why) [c](./missing.md)\n\n\`\`\`md\n[d](./example)\n\`\`\`\n`;
    expect(absolutize(text, "README.md", fakeFs)).toBe(text);
  });
});

describe("the READMEs", () => {
  const files = READMES.map((file) => ({ file, text: readFileSync(join(root, file), "utf8") }));

  test("every link is an absolute URL", () => {
    const relative = files.flatMap(({ file, text }) =>
      linksOf(text)
        .filter((link) => !/^https:\/\//.test(link.url))
        .map((link) => `${file}:${link.line} ${link.url}`),
    );
    expect(relative).toEqual([]);
  });

  test("every link to the repository names a path that exists", () => {
    const missing = files.flatMap(({ file, text }) =>
      linksOf(text)
        .map((link) => /^https:\/\/(?:github\.com\/jubr\/variant-worktrees\/(?:tree|blob)|raw\.githubusercontent\.com\/jubr\/variant-worktrees)\/main\/([^#?]+)/.exec(link.url))
        .filter((match): match is RegExpExecArray => match !== null)
        .filter((match) => !existsSync(join(root, decodeURIComponent(match[1]))))
        .map((match) => `${file}: ${match[1]}`),
    );
    expect(missing).toEqual([]);
  });

  test("none names a key, shape or state file of an earlier version", () => {
    const hits = files.flatMap(({ file, text }) =>
      [/variant\.instances/, /reservedPorts/, /variants\.local\.yaml/, /\.cache\/variants\//]
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${file}: ${pattern}`),
    );
    expect(hits).toEqual([]);
  });

  test("each opens with a link to the documentation site", () => {
    for (const { file, text } of files) {
      const first = linksOf(text).find((link) => link.url.startsWith(SITE));
      expect(first, file).toBeDefined();
      const head = text.split("\n").slice(0, 12).join("\n");
      expect(head, file).toContain(SITE);
    }
  });
});
