/**
 * Specification: openspec/specs/docs/site/spec.md
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import docsConfig from "../docs/.vitepress/config.ts";

const packageVersion = (
  JSON.parse(readFileSync(join(import.meta.dir, "../package.json"), "utf8")) as { version: string }
).version;

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

const navLinks = (html: string): { href: string; text: string }[] => {
  const start = html.indexOf('class="VPNavBarMenu');
  const end = html.indexOf("VPNavBarAppearance");
  const nav = html.slice(start, end);
  return [...nav.matchAll(/href="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/g)].map((match) => ({
    href: match[1],
    text: match[2].trim(),
  }));
};

const linkedStylesheet = (html: string): string => {
  const href = html.match(/href="(\/variant-worktrees\/assets\/[^"]+\.css)"/)?.[1];
  if (!href) {
    throw new Error("built page has no same-origin stylesheet");
  }
  return readFileSync(join(dist, href.slice(pagesBase.length)), "utf8").toLowerCase();
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

describe("dark document shell and top navigation", () => {
  const installation = () => readFileSync(join(dist, "guide/installation.html"), "utf8");

  test("shows the sidebar, search, logo, outline, copy control, and dark/light switch", () => {
    const html = installation();
    expect(html).toContain("VPSidebar");
    expect(html).toContain('aria-label="Search"');
    expect(html).toContain("logo-256.png");
    expect(html).toContain("On this page");
    expect(html).toContain('title="Copy Code"');
    expect(html).toContain("VPSwitchAppearance");
    expect(html).toContain('vitepress-theme-appearance")||"dark"');
    const css = linkedStylesheet(html);
    expect(css).toContain("#141414");
    expect(css).toContain("#ec0000");
  });

  test("links Guide, Configuration, CLI, MCP, the repository, and the versioned releases page", () => {
    const links = navLinks(installation());
    const guide = links.find((link) => link.text === "Guide");
    const configuration = links.find((link) => link.text === "Configuration");
    const cli = links.find((link) => link.text === "CLI");
    const mcp = links.find((link) => link.text === "MCP");
    const version = links.find((link) => link.text === `v${packageVersion}`);
    expect(guide?.href).toContain("/guide/");
    expect(guide?.href).not.toContain("library");
    expect(configuration?.href).toContain("library");
    expect(configuration?.href).toContain("configuration");
    expect(cli?.href).toContain("cli-vscode-webview");
    expect(cli?.href).toContain("#cli");
    expect(mcp?.href).toContain("/mcp");
    expect(version?.href).toBe("https://github.com/jubr/variant-worktrees/releases");
    expect(installation()).toContain('href="https://github.com/jubr/variant-worktrees"');
  });

  test("shows the sidebar and logo on the landing page", () => {
    const html = readFileSync(join(dist, "index.html"), "utf8");
    expect(html).toContain("has-sidebar");
    expect(html).toContain("logo-256.png");
  });
});
