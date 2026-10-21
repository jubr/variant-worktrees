/**
 * Specification: openspec/specs/docs/site/spec.md
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import docsConfig from "../docs/.vitepress/config.ts";

const root = join(import.meta.dir, "..");
const dist = join(root, "docs/.vitepress/dist");
const pagesBase = "/variant-worktrees/";

const attrsOf = (raw: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
};

const sameOriginAssets = (html: string): { kind: string; url: string }[] => {
  const found: { kind: string; url: string }[] = [];
  for (const match of html.matchAll(/<(link|script|img)\b([^>]*)>/gi)) {
    const attrs = attrsOf(match[2]);
    const rel = attrs.rel ?? "";
    if (match[1].toLowerCase() === "link" && rel.split(/\s+/).includes("icon") && attrs.href?.startsWith("/")) {
      found.push({ kind: "favicon", url: attrs.href });
    }
    if (
      match[1].toLowerCase() === "link" &&
      rel.split(/\s+/).includes("stylesheet") &&
      attrs.href?.startsWith("/")
    ) {
      found.push({ kind: "stylesheet", url: attrs.href });
    }
    if (match[1].toLowerCase() === "script" && attrs.src?.startsWith("/")) {
      found.push({ kind: "script", url: attrs.src });
    }
    if (match[1].toLowerCase() === "img" && attrs.src?.includes("logo-256")) {
      found.push({ kind: "logo", url: attrs.src });
    }
  }
  return found;
};

describe("published asset URLs", () => {
  beforeAll(() => {
    const built = spawnSync("task", ["docs:build"], { cwd: root, encoding: "utf8" });
    if (built.status !== 0) {
      throw new Error(built.stderr || built.stdout);
    }
  }, 180_000);

  test("keeps the logo and favicon config paths unprefixed and sets the pages base", () => {
    const head = docsConfig.head ?? [];
    expect(docsConfig.base).toBe(pagesBase);
    expect(docsConfig.themeConfig?.logo).toBe("/logo-256.png");
    expect(head).toContainEqual(["link", { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" }]);
    expect(head).toContainEqual(["link", { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" }]);
  });

  test("requests styles, scripts, favicons, and the logo under the pages base", () => {
    const html = readFileSync(join(dist, "index.html"), "utf8");
    const assets = sameOriginAssets(html);
    expect(assets.some((asset) => asset.kind === "stylesheet")).toBe(true);
    expect(assets.some((asset) => asset.kind === "script")).toBe(true);
    expect(assets.some((asset) => asset.kind === "favicon")).toBe(true);
    expect(assets.some((asset) => asset.kind === "logo")).toBe(true);
    for (const asset of assets) {
      expect(asset.url.startsWith(pagesBase)).toBe(true);
      const file = join(dist, asset.url.slice(pagesBase.length));
      expect(existsSync(file)).toBe(true);
    }
  });
});
