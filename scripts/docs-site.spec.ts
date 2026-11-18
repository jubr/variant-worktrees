/**
 * Specification: openspec/specs/docs/site/spec.md
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import docsConfig from "../docs/.vitepress/config.ts";

const packageVersion = (
  JSON.parse(readFileSync(join(import.meta.dir, "../package.json"), "utf8")) as { version: string }
).version;

const root = join(import.meta.dir, "..");
const dist = join(root, "docs/.vitepress/dist");

const attrsOf = (raw: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
};

/** Stylesheets, scripts, favicons and the logo a page requests from its own site, as written in its HTML. */
const ownAssets = (html: string): { kind: string; url: string }[] => {
  const found: { kind: string; url: string }[] = [];
  const own = (url: string | undefined): url is string => url !== undefined && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url);
  for (const match of html.matchAll(/<(link|script|img)\b([^>]*)>/gi)) {
    const attrs = attrsOf(match[2]);
    const tag = match[1].toLowerCase();
    const rel = (attrs.rel ?? "").split(/\s+/);
    if (tag === "link" && rel.includes("icon") && own(attrs.href)) found.push({ kind: "favicon", url: attrs.href });
    if (tag === "link" && rel.includes("stylesheet") && own(attrs.href)) {
      found.push({ kind: "stylesheet", url: attrs.href });
    }
    if (tag === "script" && own(attrs.src)) found.push({ kind: "script", url: attrs.src });
    if (tag === "img" && attrs.src?.includes("logo-256")) found.push({ kind: "logo", url: attrs.src });
  }
  return found;
};

const navLinks = (html: string): { href: string; text: string }[] => {
  const start = html.indexOf('VPNavBarMenu menu');
  const end = html.indexOf("VPNavBarAppearance");
  const nav = html.slice(start, end);
  return [...nav.matchAll(/href="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/g)].map((match) => ({
    href: match[1],
    text: match[2].trim(),
  }));
};

const linkedStylesheet = (html: string, path: string): string => {
  const href = ownAssets(html).find((asset) => asset.kind === "stylesheet" && asset.url.includes("assets/"))?.url;
  if (!href) {
    throw new Error("built page has no same-origin stylesheet");
  }
  return readFileSync(resolve(dist, dirname(path), href), "utf8").toLowerCase();
};

describe("relocatable asset URLs", () => {
  beforeAll(() => {
    // AIDEV-NOTE: with the packages built, docs:site skips the package rebuild that rewrites dist/ beside concurrent package tests
    const prebuilt = existsSync(join(root, "packages/variant-log/dist/index.js"));
    const built = spawnSync("task", [prebuilt ? "docs:site" : "docs:build"], { cwd: root, encoding: "utf8" });
    if (built.status !== 0) {
      throw new Error(built.stderr || built.stdout);
    }
  }, 180_000);

  test("sets a relative base, keeps the logo path, and leaves cleanUrls off", () => {
    expect(docsConfig.base).toBe("./");
    expect(docsConfig.themeConfig?.logo).toBe("/logo-256.png");
    expect(docsConfig.cleanUrls ?? false).toBe(false);
  });

  for (const path of ["index.html", "guide/installation.html"]) {
    test(`${path} requests styles, scripts, favicons, and the logo relative to itself`, () => {
      const assets = ownAssets(readFileSync(join(dist, path), "utf8"));
      for (const kind of ["stylesheet", "script", "favicon", "logo"]) {
        expect(assets.some((asset) => asset.kind === kind), kind).toBe(true);
      }
      for (const asset of assets) {
        expect(asset.url.startsWith("/"), asset.url).toBe(false);
        expect(asset.url).not.toContain("/variant-worktrees/");
        expect(existsSync(resolve(dist, dirname(path), asset.url)), asset.url).toBe(true);
      }
    });
  }
});

describe("dark document shell and top navigation", () => {
  const installation = () => readFileSync(join(dist, "guide/installation.html"), "utf8");

  test("shows the sidebar, search, logo, outline, copy control, and dark/light switch", () => {
    const html = installation();
    expect(html).toContain("VPSidebar");
    expect(html).toContain('aria-label="Search"');
    expect(html).toContain("logo-256.png");
    expect(html).toContain("On this page");
    expect(html).toContain('title="Copy code"');
    expect(html).toContain("VPSwitchAppearance");
    expect(html).toMatch(/vitepress-theme-appearance[`"']\)\|\|[`"']dark[`"']/);
    const css = linkedStylesheet(html, "guide/installation.html");
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
    expect(configuration?.href).toContain("/guide/configuration");
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

  test("lists Getting Started, then Variant Worktrees, Chat Renamer, and Development", () => {
    const html = installation();
    const start = html.indexOf("VPSidebar");
    const end = html.indexOf("VPContent", start);
    const sidebar = html.slice(start, end);
    const at = (needle: string) => sidebar.indexOf(needle);
    expect(at("Getting Started")).toBeGreaterThan(-1);
    expect(at("Getting Started")).toBeLessThan(at("Variant Worktrees"));
    expect(at("/guide/core")).toBeLessThan(at("/guide/configuration"));
    expect(at("/guide/configuration")).toBeLessThan(at("/guide/installation"));
    expect(at("/guide/installation")).toBeLessThan(at("/guide/runtime"));
    expect(at("/guide/runtime")).toBeLessThan(at("VSCode / Cursor"));
    expect(at("VSCode / Cursor")).toBeLessThan(at("/guide/extension"));
    expect(at("/guide/extension")).toBeLessThan(at("/mcp"));
    expect(at("/mcp")).toBeLessThan(at("/guide/socket-ipc"));
    expect(at("/guide/socket-ipc")).toBeLessThan(at("Chat Renamer"));
    expect(at("/chat-renamer/index")).toBeLessThan(at("/chat-renamer/configuration"));
    expect(at("Chat Renamer")).toBeGreaterThan(at("Variant Worktrees"));
    expect(at("Development")).toBeGreaterThan(at("Chat Renamer"));
    expect(at("Development")).toBeLessThan(at("/development/building"));
    expect(at("/development/building")).toBeLessThan(at("/guide/library"));
    expect(at("/guide/library")).toBeLessThan(at("/api/"));
    expect(sidebar).toContain("/development/building");
    expect(sidebar).toContain("/chat-renamer/");
    expect(sidebar).not.toContain("Introduction");
    expect(sidebar).not.toContain(">Reference<");
    expect(html).not.toContain("/guide/scripts");
  });
});

describe("getting started and building", () => {
  test("shows both workflows, the mise install, and optional databases", () => {
    const html = readFileSync(join(dist, "guide/index.html"), "utf8");
    const text = html.replace(/<[^>]+>/g, "");
    expect(text.indexOf("How it works")).toBeLessThan(text.indexOf("mise use github:jubr/variant-worktrees"));
    expect(text).toContain("mise use github:jubr/variant-worktrees");
    expect(html).toContain("https://mise.jdx.dev");
    expect(html).toContain("/guide/configuration");
    expect(text).toContain("variant watch -s feature-forty-two");
    expect(text).toContain("cd _v-feature-forty-two");
    expect(text).toContain("PostgreSQL");
    expect(text).toContain("MySQL");
    expect(text).toContain("SQLite");
    expect(text).toContain("optional");
  });

  test("documents the source build", () => {
    const html = readFileSync(join(dist, "development/building.html"), "utf8");
    expect(html).toContain("Bun");
    expect(html).toContain("task bootstrap");
    expect(html).toContain("task build");
  });

  test("tracked docs omit the API key and the CLI library name", () => {
    const listed = spawnSync("git", ["ls-files", "docs"], { cwd: root, encoding: "utf8" });
    const files = listed.stdout.split("\n").filter(Boolean);
    const hits = files.filter((file) => {
      const path = join(root, file);
      if (!existsSync(path)) return false;
      const text = readFileSync(path, "utf8");
      return text.includes("VARIANT_API_KEY") || text.includes("cleye");
    });
    expect(hits).toEqual([]);
  });
});

const page = (path: string): string => readFileSync(join(dist, path), "utf8");
/** The visible text of the document body of a built page: no sidebar, navigation, scripts or footer. */
const textOf = (html: string): string => {
  const start = html.indexOf('class="vp-doc');
  const end = html.indexOf("VPDocFooter", start);
  return html
    .slice(start, end === -1 ? undefined : end)
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
};
const trackedDocs = (): string[] => {
  const listed = spawnSync("git", ["ls-files", "docs"], { cwd: root, encoding: "utf8" });
  return listed.stdout.split("\n").filter((file) => file && existsSync(join(root, file)));
};

describe("installation into an existing project", () => {
  test("shows the mise flavor first, then the extension flavor, and links to Development", () => {
    const html = page("guide/installation.html");
    const text = textOf(html);
    expect(text).toContain("mise x github:jubr/variant-worktrees@latest -- variant init");
    expect(text).toContain("brew install mise");
    expect(text).toContain("mise.run");
    expect(text).toContain("Variant Worktrees");
    expect(text).toContain("Cursor");
    expect(text).toContain("Onboarding");
    expect(text.indexOf("variant init")).toBeLessThan(text.indexOf("Onboarding"));
    expect(html).toContain("/development/");
  });

  test("tracked docs have no npm install, npx or bun add", () => {
    const hits = trackedDocs().filter((file) => /npm install|\bnpx\b|bun add/.test(readFileSync(join(root, file), "utf8")));
    expect(hits).toEqual([]);
  });

  test("installs the library and the MCP server from Development, not from the installation page", () => {
    const installation = textOf(page("guide/installation.html"));
    expect(installation).not.toContain("variant-api");
    expect(installation).not.toContain("variant-mcp");
    const building = textOf(page("development/building.html"));
    expect(building).toContain("variant-api");
    expect(building).toContain("variant-mcp");
  });
});

const decodeEntities = (text: string): string =>
  text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");

/** Headings of a built page in document order, with level, anchor id and plain text. */
const headingsOf = (html: string): { level: number; id: string; text: string }[] =>
  [...html.matchAll(/<h([1-6]) id="([^"]*)"[^>]*>([\s\S]*?)<a class="header-anchor"/g)].map((match) => ({
    level: Number(match[1]),
    id: match[2],
    text: decodeEntities(match[3].replace(/<[^>]+>/g, "")).trim(),
  }));

describe("configuration page structure", () => {
  const headings = () => headingsOf(page("guide/configuration.html"));
  const schema = JSON.parse(
    readFileSync(join(root, "packages/variant-config/variants.yaml.schema.json"), "utf8"),
  ) as { properties: { variant: { properties: Record<string, unknown> } } };
  const optionKeys = Object.keys(schema.properties.variant.properties);

  test("gives every key of variant its own heading with an anchor", () => {
    const found = headings().filter((heading) => heading.text.startsWith("variant."));
    for (const key of optionKeys) {
      const heading = found.find((candidate) => candidate.text === `variant.${key}`);
      expect(heading?.id).toBe(`variant-${key.toLowerCase()}`);
    }
  });

  test("lists the option headings alphabetically", () => {
    const names = headings()
      .map((heading) => heading.text)
      .filter((text) => /^variant\.\w+$/.test(text));
    expect(names.length).toBe(optionKeys.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test("opens with Options, then Templates, and ends with Unknown keys and migration", () => {
    const sections = headings()
      .filter((heading) => heading.level === 2)
      .map((heading) => heading.text);
    expect(sections[0]).toBe("Options");
    expect(sections.indexOf("Templates")).toBeGreaterThan(0);
    expect(sections.at(-1)).toBe("Unknown keys and migration");
  });
});

describe("outline", () => {
  test("covers second and third level headings", () => {
    // AIDEV-NOTE: the outline items are drawn in the browser, so the static HTML only proves the levels and the headings
    expect(docsConfig.themeConfig?.outline).toEqual({ level: [2, 3] });
    const headings = headingsOf(page("guide/configuration.html"));
    expect(headings.find((heading) => heading.text === "variant.abbr")?.level).toBe(3);
    expect(headings.find((heading) => heading.text === "Templates")?.level).toBe(2);
  });
});

describe("runtime page", () => {
  const moved = ["Runtime", "Environment through Mise", "Environment variables", "When watches are omitted"];

  test("holds the runtime, environment and detection sections", () => {
    const texts = headingsOf(page("guide/runtime.html")).map((heading) => heading.text);
    for (const heading of moved) {
      expect(texts).toContain(heading);
    }
  });

  test("leaves them out of the configuration page", () => {
    const texts = headingsOf(page("guide/configuration.html")).map((heading) => heading.text);
    for (const heading of moved) {
      expect(texts).not.toContain(heading);
    }
  });
});

describe("library, extension and socket pages", () => {
  test("the library page is code with one-line captions and links into Core", () => {
    const html = page("guide/library.html");
    expect(html).toContain("createVariantClient");
    expect(html).toContain("/guide/core");
    const doc = html.slice(html.indexOf('class="vp-doc'), html.indexOf("VPDocFooter"));
    const captions = [...doc.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => match[1].replace(/<[^>]+>/g, ""));
    for (const caption of captions) {
      expect(caption.length).toBeLessThan(200);
    }
  });

  test("the extension page documents the view, onboarding, MCP registration and the chat renamer", () => {
    const text = textOf(page("guide/extension.html"));
    expect(text).toContain("Variants view");
    expect(text).toContain("Onboarding");
    expect(text).toContain("MCP");
    expect(text).toContain("chat renamer");
  });

  test("the socket page is Socket IPC at /guide/socket-ipc", () => {
    expect(headingsOf(page("guide/socket-ipc.html"))[0]?.text).toBe("Socket IPC");
    expect(existsSync(join(dist, "guide/ipc.html"))).toBe(false);
  });
});

describe("cross-links into the VSCode / Cursor group", () => {
  // AIDEV-NOTE: the sidebar links every page from every page, so links are read from the document body only
  const linksTo = (path: string, target: string): boolean => {
    const html = page(path);
    const body = html.slice(html.indexOf('class="vp-doc'), html.indexOf("VPDocFooter"));
    return [...body.matchAll(/href="([^"#]+)/g)].some((match) => {
      const resolved = new URL(match[1], `https://docs.test/${path}`).pathname;
      return resolved.replace(/\.html$/, "") === target;
    });
  };
  const guide = (name: string) => `guide/${name}.html`;

  test("Getting Started, Installation, Core, Configuration, Runtime and Library link to the extension", () => {
    for (const path of ["index", "installation", "core", "configuration", "runtime", "library"].map(guide)) {
      expect(linksTo(path, "/guide/extension"), path).toBe(true);
    }
  });

  test("Getting Started, Installation and Library link to the MCP server; Runtime to the socket", () => {
    for (const path of ["index", "installation", "library"].map(guide)) {
      expect(linksTo(path, "/mcp"), path).toBe(true);
    }
    expect(linksTo(guide("runtime"), "/guide/socket-ipc")).toBe(true);
  });

  test("the group links back to Installation, and the extension to its neighbours", () => {
    for (const path of [guide("extension"), "mcp.html", guide("socket-ipc")]) {
      expect(linksTo(path, "/guide/installation"), path).toBe(true);
    }
    for (const target of ["/mcp", "/guide/socket-ipc", "/guide/configuration", "/guide/runtime"]) {
      expect(linksTo(guide("extension"), target), target).toBe(true);
    }
  });
});

describe("remote personal-site attribution", () => {
  test("tracked docs omit the forbidden host and image", () => {
    const listed = spawnSync("git", ["ls-files", "docs"], { cwd: root, encoding: "utf8" });
    const files = listed.stdout.split("\n").filter(Boolean);
    const hits = files.filter((file) => {
      const path = join(root, file);
      if (!existsSync(path)) return false;
      const text = readFileSync(path, "utf8");
      return text.includes("zach.dev") || text.includes("statue.png");
    });
    expect(hits).toEqual([]);
  });

  test("built home page omits the forbidden host, image, and fixed corner", () => {
    const html = readFileSync(join(dist, "index.html"), "utf8");
    expect(html).not.toContain("zach.dev");
    expect(html).not.toContain("statue.png");
    expect(html).not.toContain("zach-footer-logo");
  });
});

/** The declarations of every rule of a stylesheet whose selector list contains `selector`, lowercased and without spaces. */
const declarationsFor = (css: string, selector: string): string[] =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1].split(",").some((candidate) => candidate.trim() === selector))
    .map((match) => match[2].replace(/\s+/g, ""));

describe("code does not use ligatures", () => {
  const css = () => linkedStylesheet(page("guide/installation.html"), "guide/installation.html");

  for (const selector of ["code", "pre"]) {
    test(`the stylesheet turns ligatures and contextual alternates off for ${selector}`, () => {
      const rules = declarationsFor(css(), selector);
      expect(
        rules.some((rule) => rule.includes("font-variant-ligatures:none")),
        `${selector}: ${rules.join(" | ")}`,
      ).toBe(true);
      expect(rules.some((rule) => /"liga"(0|off)/.test(rule) && /"calt"(0|off)/.test(rule))).toBe(true);
    });
  }

  test("inline code keeps the typed characters", () => {
    const html = page("guide/overview.html");
    expect(html).toContain("VARIANT_STEP_&lt;STEP&gt;=no");
    expect(textOf(html)).toContain("VARIANT_STEP_<STEP>=no");
    // AIDEV-NOTE: the page has invisible characters elsewhere (heading anchors), so only code is checked: a zero-width character would be copied with a command
    const code = [...html.matchAll(/<code[^>]*>([\s\S]*?)<\/code>/g)].map((match) => match[1]).join("");
    expect(code.length).toBeGreaterThan(0);
    expect(code).not.toMatch(/[\u200b\u200c\u200d\u2060\ufeff]|&ZeroWidthSpace;|&#8203;|&#x200b;/i);
  });
});

type JsonSchema = { properties?: Record<string, JsonSchema>; additionalProperties?: JsonSchema | boolean };
const yamlSchema = JSON.parse(readFileSync(join(root, "packages/variant-config/variants.yaml.schema.json"), "utf8")) as JsonSchema;
// AIDEV-NOTE: a key chosen by the user is written with a placeholder in the heading, so the docs can name its options
const PLACEHOLDERS: Record<string, string> = { watches: "<key>", steps: "<name>" };

/** Every property path of the schema, parents before children, with `<key>` and `<name>` for user-chosen names. */
const schemaPaths = (node: JsonSchema, prefix: string[] = []): string[] => {
  const paths: string[] = [];
  for (const [key, child] of Object.entries(node.properties ?? {})) {
    const path = [...prefix, key];
    paths.push(path.join("."), ...schemaPaths(child, path));
  }
  const extra = node.additionalProperties;
  if (typeof extra === "object" && extra.properties) {
    const placeholder = PLACEHOLDERS[prefix.at(-1) ?? ""];
    if (!placeholder) {
      throw new Error(`the schema has user-chosen keys below ${prefix.join(".")}; give them a placeholder`);
    }
    const path = [...prefix, placeholder];
    paths.push(path.join("."), ...schemaPaths(extra, path));
  }
  return paths;
};
/** The paths below the top-level sections `db`, `variant` and `chatRenamer`. */
const keyPaths = (section: string): string[] => schemaPaths(yamlSchema).filter((path) => path.startsWith(`${section}.`));

/** The HTML of a heading and what follows it, up to the next heading of the same or a higher level. */
const sectionOf = (html: string, id: string): string => {
  const start = html.search(new RegExp(`<h[1-6] id="${id}"`));
  expect(start, `heading #${id}`).toBeGreaterThanOrEqual(0);
  const level = Number(html[start + 2]);
  const rest = html.slice(start + 1);
  const next = rest.search(new RegExp(`<h[1-${level}] id=`));
  return next === -1 ? rest : rest.slice(0, next);
};

/** The internal links of an HTML fragment of a built page, resolved against that page, without `.html`. */
const linksOf = (html: string, from: string): { path: string; hash: string }[] =>
  [...html.matchAll(/href="([^"]+)"/g)]
    .filter((match) => !/^[a-z][a-z0-9+.-]*:/i.test(match[1]))
    .map((match) => {
      const url = new URL(match[1], `https://docs.test/${from}`);
      return { path: url.pathname.replace(/\.html$/, "").replace(/\/index$/, "/"), hash: url.hash.slice(1) };
    });

/** The text of the first cell of every body row of the tables in an HTML fragment. */
const firstCells = (html: string): string[] =>
  [...html.matchAll(/<tr>\s*<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) =>
    decodeEntities(match[1].replace(/<[^>]+>/g, "")).trim(),
  );

describe("configuration page, sub-keys and templates", () => {
  const configuration = () => page("guide/configuration.html");
  const headings = () => headingsOf(configuration());

  test("every sub-key of variant has a third-level heading of its full path", () => {
    const found = new Map(headings().map((heading) => [heading.text, heading.level]));
    const missing = keyPaths("variant").filter((path) => found.get(path) !== 3);
    expect(missing).toEqual([]);
  });

  test("every key of db and db.multi has a third-level heading of its full path, in a Database section", () => {
    const found = new Map(headings().map((heading) => [heading.text, heading.level]));
    expect(keyPaths("db").filter((path) => found.get(path) !== 3)).toEqual([]);
    expect(headings().some((heading) => heading.level === 2 && heading.text === "Database")).toBe(true);
    expect(headings().some((heading) => heading.level === 2 && heading.text === "db.multi")).toBe(false);
  });

  test("the headings of each section are in alphabetical order by full path", () => {
    for (const section of ["variant.", "db."]) {
      const names = headings()
        .map((heading) => heading.text)
        .filter((text) => text.startsWith(section));
      expect(names, section).toEqual([...names].sort());
    }
  });

  test("the sections are Options, then Database, then Templates, and Unknown keys and migration last", () => {
    const sections = headings()
      .filter((heading) => heading.level === 2)
      .map((heading) => heading.text);
    expect(sections.slice(0, 3)).toEqual(["Options", "Database", "Templates"]);
    expect(sections.at(-1)).toBe("Unknown keys and migration");
  });

  test("the options end with a chatRenamer.* entry that links to the chat renamer configuration", () => {
    const all = headings();
    const database = all.findIndex((heading) => heading.text === "Database");
    const last = all[database - 1];
    expect(last?.text).toBe("chatRenamer.*");
    const links = linksOf(sectionOf(configuration(), last.id), "guide/configuration.html");
    expect(links.some((link) => link.path === "/chat-renamer/configuration")).toBe(true);
  });

  test("variant.steps links to the flow of steps in the Overview", () => {
    const links = linksOf(sectionOf(configuration(), "variant-steps"), "guide/configuration.html");
    expect(links).toContainEqual({ path: "/guide/overview", hash: "flow-of-steps" });
  });

  test("the templates are listed in a table", () => {
    const html = sectionOf(configuration(), "templates");
    const cells = firstCells(html);
    const expected = [
      "${slug}",
      "${schema}",
      "${storage}",
      "${worktree}",
      "${url}",
      "${port}",
      "${<watch>.port}",
      "${abbr}",
      "${multi.tenants}",
      "${multi.schemaPrefix}",
      "${NAME}",
      "${NAME:-default}",
      "$${",
    ];
    expect(expected.filter((item) => !cells.includes(item))).toEqual([]);
  });
});

describe("no earlier configuration shapes in the docs", () => {
  test("tracked docs name no earlier key, shape or state file", () => {
    const patterns = [
      /variant\.instances/,
      /reservedPorts/,
      /\{\{\.\.\.\}\}/,
      /`run` key/,
      /former shape/,
      /variants\.local\.yaml/,
      /\.cache\/variants\//,
    ];
    const hits = trackedDocs().flatMap((file) => {
      const text = readFileSync(join(root, file), "utf8");
      return patterns.filter((pattern) => pattern.test(text)).map((pattern) => `${file}: ${pattern}`);
    });
    expect(hits).toEqual([]);
  });
});
