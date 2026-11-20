/**
 * Specification: openspec/specs/docs/site/spec.md
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { linksOf as readmeLinks, READMES, SITE } from "./readme-links.ts";
import { DEFAULT_ACTIVATION_PATTERNS } from "../packages/chat-renamer-config/src/defaults.ts";
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
    const built = spawnSync("task", ["docs:build"], { cwd: root, encoding: "utf8" });
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

  test("links Configuration, CLI, MCP, the repository, and the versioned releases page", () => {
    const links = navLinks(installation());
    const configuration = links.find((link) => link.text === "Configuration");
    const cli = links.find((link) => link.text === "CLI");
    const mcp = links.find((link) => link.text === "MCP");
    const version = links.find((link) => link.text === `v${packageVersion}`);
    expect(links.find((link) => link.text === "Guide")).toBeUndefined();
    expect(configuration?.href).toContain("/guide/configuration");
    expect(cli?.href).toContain("/guide/cli");
    expect(mcp?.href).toContain("/vscode/mcp");
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
    expect(at("/guide/commands")).toBeLessThan(at("/guide/cli"));
    expect(at("/guide/cli")).toBeLessThan(at("/guide/configuration"));
    expect(at("/guide/configuration")).toBeLessThan(at("/guide/installation"));
    expect(at("/guide/installation")).toBeLessThan(at("/guide/runtime"));
    expect(at("/guide/runtime")).toBeLessThan(at("VSCode / Cursor"));
    expect(at("VSCode / Cursor")).toBeLessThan(at("/vscode/extension"));
    expect(at("/vscode/extension")).toBeLessThan(at("/vscode/mcp"));
    expect(at("/vscode/mcp")).toBeLessThan(at("/vscode/socket-ipc"));
    expect(at("/vscode/socket-ipc")).toBeLessThan(at("Chat Renamer"));
    expect(at("/chat-renamer/index")).toBeLessThan(at("/chat-renamer/configuration"));
    expect(at("Chat Renamer")).toBeGreaterThan(at("Variant Worktrees"));
    expect(at("Development")).toBeGreaterThan(at("Chat Renamer"));
    expect(at("Development")).toBeLessThan(at("/development/building"));
    expect(at("/development/building")).toBeLessThan(at("/development/library"));
    expect(sidebar).toContain("/development/building");
    expect(sidebar).toContain("/chat-renamer/");
    expect(sidebar).not.toContain("Introduction");
    expect(sidebar).not.toContain(">Reference<");
    expect(html).not.toContain("/guide/scripts");
  });
});

describe("getting started and building", () => {
  test("shows both workflows, the mise install, and optional databases", () => {
    const html = readFileSync(join(dist, "index.html"), "utf8");
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
  test("shows the extension flavor first, then the mise flavor", () => {
    const html = page("guide/installation.html");
    const text = textOf(html);
    expect(text).toContain("mise x github:jubr/variant-worktrees@latest -- variant init");
    expect(text).toContain("brew install mise");
    expect(text).toContain("mise.run");
    expect(text).toContain("Variant Worktrees");
    expect(text).toContain("Cursor");
    expect(text).toContain("Onboarding");
    expect(text.indexOf("Onboarding")).toBeLessThan(text.indexOf("variant init"));
    expect(html).toContain("marketplace.visualstudio.com/items?itemName=jubr.variant-worktrees");
    expect(html).toContain("open-vsx.org/extension/jubr/variant-worktrees");
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

  test("opens with Variant options, then Templates, and ends with Unknown keys and migration", () => {
    const sections = headings()
      .filter((heading) => heading.level === 2)
      .map((heading) => heading.text);
    expect(sections[0]).toBe("Variant options");
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
  test("the library page is code with one-line captions and links into Commands", () => {
    const html = page("development/library.html");
    expect(html).toContain("createVariantClient");
    expect(html).toContain("/guide/commands");
    const doc = html.slice(html.indexOf('class="vp-doc'), html.indexOf("VPDocFooter"));
    const captions = [...doc.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => match[1].replace(/<[^>]+>/g, ""));
    for (const caption of captions) {
      expect(caption.length).toBeLessThan(200);
    }
  });

  test("the extension page documents the view, onboarding, MCP registration and the chat renamer", () => {
    const text = textOf(page("vscode/extension.html"));
    expect(text).toContain("Variants view");
    expect(text).toContain("Onboarding");
    expect(text).toContain("MCP");
    expect(text).toContain("chat renamer");
  });

  test("the socket page is Socket IPC at /vscode/socket-ipc", () => {
    expect(headingsOf(page("vscode/socket-ipc.html"))[0]?.text).toBe("Socket IPC");
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

  test("Getting Started, Installation, Commands, Configuration, Runtime and Library link to the extension", () => {
    for (const path of ["index.html", ...["installation", "commands", "configuration", "runtime"].map(guide), "development/library.html"]) {
      expect(linksTo(path, "/vscode/extension"), path).toBe(true);
    }
  });

  test("Getting Started, Installation and Library link to the MCP server; Runtime to the socket", () => {
    for (const path of ["index.html", guide("installation"), "development/library.html"]) {
      expect(linksTo(path, "/vscode/mcp"), path).toBe(true);
    }
    expect(linksTo(guide("runtime"), "/vscode/socket-ipc")).toBe(true);
  });

  test("the group links back to Installation, and the extension to its neighbours", () => {
    for (const path of ["vscode/extension.html", "vscode/mcp.html", "vscode/socket-ipc.html"]) {
      expect(linksTo(path, "/guide/installation"), path).toBe(true);
    }
    for (const target of ["/vscode/mcp", "/guide/configuration", "/guide/runtime"]) {
      expect(linksTo("vscode/extension.html", target), target).toBe(true);
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

  test("every key of db and db.multi has a third-level heading of its full path, in a Database options section", () => {
    const found = new Map(headings().map((heading) => [heading.text, heading.level]));
    expect(keyPaths("db").filter((path) => found.get(path) !== 3)).toEqual([]);
    expect(headings().some((heading) => heading.level === 2 && heading.text === "Database options")).toBe(true);
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

  test("the sections are the variant, chat renamer and database options, templates, and unknown keys", () => {
    const sections = headings()
      .filter((heading) => heading.level === 2)
      .map((heading) => heading.text);
    expect(sections).toEqual([
      "Variant options",
      "Chat Renamer options",
      "Database options",
      "Templates",
      "Unknown keys and migration",
    ]);
  });

  test("the Chat Renamer options section links to the chat renamer configuration and has no key headings", () => {
    const id = headings().find((heading) => heading.text === "Chat Renamer options")?.id ?? "";
    const section = sectionOf(configuration(), id);
    expect(linksOf(section, "guide/configuration.html").some((link) => link.path === "/chat-renamer/configuration")).toBe(
      true,
    );
    expect(section).not.toMatch(/<h3\b/);
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

  test("the templates table has the columns Item, Meaning, Example use and Example value, and a value in every row", () => {
    const html = sectionOf(configuration(), "templates");
    const text = (cell: string) => decodeEntities(cell.replace(/<[^>]+>/g, "")).trim();
    const header = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((match) => text(match[1]));
    expect(header).toEqual(["Item", "Meaning", "Example use", "Example value"]);
    const rows = [...html.matchAll(/<tr>(\s*<td[\s\S]*?)<\/tr>/g)].map((match) =>
      [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => text(cell[1])),
    );
    expect(rows.length).toBeGreaterThanOrEqual(13);
    for (const row of rows) {
      expect(row.length, row[0]).toBe(4);
      expect(row[3], `${row[0]} has an example value`).not.toBe("");
    }
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

describe("runtime page, watching and up", () => {
  const headings = () => headingsOf(page("guide/runtime.html")).filter((heading) => heading.level <= 3);

  test("Watching holds the interactive keys, reattaching and exit status", () => {
    const all = headings();
    const watching = all.findIndex((heading) => heading.text === "Watching");
    expect(all[watching]?.level).toBe(2);
    expect(all.slice(watching + 1, watching + 4).map((heading) => [heading.level, heading.text])).toEqual([
      [3, "Interactive keys"],
      [3, "Reattaching"],
      [3, "Exit status"],
    ]);
  });

  test("Up is a section of its own after Watching and before the environment", () => {
    const texts = headings()
      .filter((heading) => heading.level === 2)
      .map((heading) => heading.text);
    expect(texts.indexOf("Up")).toBe(texts.indexOf("Watching") + 1);
    expect(texts.indexOf("Environment through Mise")).toBe(texts.indexOf("Up") + 1);
  });
});

const { commands } = (await import(new URL("./commands.ts", import.meta.resolve("variant-api/bundle")).href)) as {
  commands: { name: string; args: { name: string }[]; mcpFixed?: Record<string, unknown> }[];
};

describe("mcp tools have a heading each", () => {
  const html = () => page("vscode/mcp.html");
  const toolHeadings = () => {
    const all = headingsOf(html());
    const start = all.findIndex((heading) => heading.level === 2 && heading.text === "Available tools");
    expect(start, "Available tools").toBeGreaterThanOrEqual(0);
    const after = all.slice(start + 1);
    const end = after.findIndex((heading) => heading.level <= 2);
    return (end === -1 ? after : after.slice(0, end)).filter((heading) => heading.level === 3);
  };

  test("one third-level heading per registered command, in registration order", () => {
    expect(toolHeadings().map((heading) => heading.text)).toEqual(commands.map((command) => `variant_${command.name}`));
  });

  for (const command of commands) {
    test(`variant_${command.name} links to ${command.name} in Commands and lists the parameters it takes`, () => {
      const heading = toolHeadings().find((candidate) => candidate.text === `variant_${command.name}`);
      expect(heading, `heading variant_${command.name}`).toBeDefined();
      const section = sectionOf(html(), heading?.id ?? "");
      expect(linksOf(section, "vscode/mcp.html")).toContainEqual({ path: "/guide/commands", hash: command.name });
      const offered = command.args.map((arg) => arg.name).filter((name) => !(name in (command.mcpFixed ?? {})));
      expect(firstCells(section)).toEqual(offered);
    });
  }
});

describe("chat renamer configuration page and schema coverage", () => {
  const chat = () => headingsOf(page("chat-renamer/configuration.html"));

  test("every chatRenamer key and sub-key has a third-level heading of its full path", () => {
    const found = new Map(chat().map((heading) => [heading.text, heading.level]));
    expect(keyPaths("chatRenamer").filter((path) => found.get(path) !== 3)).toEqual([]);
  });

  test("the chatRenamer headings are in alphabetical order by full path", () => {
    const names = chat()
      .map((heading) => heading.text)
      .filter((text) => text.startsWith("chatRenamer."));
    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual([...names].sort());
  });

  test("the page opens with Options and ends with the editor settings", () => {
    const sections = chat()
      .filter((heading) => heading.level === 2)
      .map((heading) => heading.text);
    expect(sections[0]).toBe("Options");
    expect(sections.at(-1)).toBe("Editor settings");
  });

  test("every property path of the variants.yaml schema has a heading on a configuration page", () => {
    const documented = new Set(
      [...headingsOf(page("guide/configuration.html")), ...chat()].map((heading) => heading.text),
    );
    const missing = ["db", "variant", "chatRenamer"].flatMap(keyPaths).filter((path) => !documented.has(path));
    expect(missing).toEqual([]);
  });
});

const builtPages = (): string[] =>
  (readdirSync(dist, { recursive: true }) as string[]).filter((file) => file.endsWith(".html")).sort();

type BuiltLink = { from: string; href: string; file: string; hash: string };

/** Every internal anchor of every built page, resolved to the file it names: `from` is the page that holds it. */
const internalLinks = (): BuiltLink[] =>
  builtPages().flatMap((from) =>
    [...page(from).matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)]
      .map((match) => decodeEntities(match[1]))
      .filter((href) => !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href))
      .map((href) => {
        const url = new URL(href, `https://docs.test/${from}`);
        const path = decodeURIComponent(url.pathname.slice(1));
        const file = path.endsWith("/") || path === "" ? `${path}index.html` : /\.[a-z0-9]+$/i.test(path) ? path : `${path}.html`;
        return { from, href, file, hash: decodeURIComponent(url.hash.slice(1)) };
      }),
  );

describe("internal links resolve", () => {
  const links = () => internalLinks();

  test("every internal href of every built page names a file of the build", () => {
    const dead = links()
      .filter((link) => !existsSync(join(dist, link.file)))
      .map((link) => `${link.from}: ${link.href}`);
    expect(dead).toEqual([]);
  });

  test("the check sees the navigation and the sidebar", () => {
    const all = links();
    const nav = page("guide/installation.html");
    const navStart = nav.indexOf("VPNavBarMenu menu");
    expect(navStart).toBeGreaterThan(-1);
    const fromNav = all.filter((link) => link.from === "guide/installation.html");
    expect(fromNav.some((link) => nav.slice(navStart, nav.indexOf("VPNavBarAppearance")).includes(`href="${link.href}"`))).toBe(true);
    const sidebar = nav.slice(nav.indexOf('class="VPSidebar'), nav.indexOf('class="VPContent'));
    expect(sidebar).toContain("href=");
    expect(fromNav.some((link) => sidebar.includes(`href="${link.href}"`))).toBe(true);
    expect(fromNav.some((link) => link.file === "guide/commands.html")).toBe(true);
  });

  test("every fragment of an internal link is an id of the page it names", () => {
    const ids = new Map<string, Set<string>>();
    const idsOf = (file: string): Set<string> => {
      let found = ids.get(file);
      if (!found) {
        found = new Set([...page(file).matchAll(/\s(?:id|name)="([^"]*)"/g)].map((match) => match[1]));
        ids.set(file, found);
      }
      return found;
    };
    const dead = links()
      .filter((link) => link.hash !== "" && existsSync(join(dist, link.file)) && link.file.endsWith(".html"))
      .filter((link) => !idsOf(link.file).has(link.hash))
      .map((link) => `${link.from}: ${link.href}`);
    expect([...new Set(dead)]).toEqual([]);
  });
});

/** The document body of a built page, without the sidebar, navigation and footer. */
const bodyOf = (html: string): string => {
  const start = html.indexOf('class="vp-doc');
  const end = html.indexOf("VPDocFooter", start);
  return html.slice(start, end === -1 ? undefined : end);
};
const wordsIn = (html: string): number =>
  decodeEntities(html.replace(/<[^>]+>/g, " "))
    .split(/\s+/)
    .filter(Boolean).length;
const GUIDE = "guide/";

describe("pages link into the heading that explains the topic", () => {
  const linksFrom = (path: string, html = bodyOf(page(path))) => linksOf(html, path);
  const has = (links: { path: string; hash: string }[], path: string, hash?: string) =>
    links.some((link) => link.path === path && (hash === undefined || link.hash === hash));

  test("Getting Started links to the flow of steps, and Configuration's variant.steps section does too", () => {
    expect(has(linksFrom("index.html"), "/guide/overview", "flow-of-steps")).toBe(true);
    const section = sectionOf(page("guide/configuration.html"), "variant-steps");
    expect(has(linksOf(section, "guide/configuration.html"), "/guide/overview", "flow-of-steps")).toBe(true);
  });

  test("Commands links to Configuration headings, never to the top of the page", () => {
    const toConfiguration = linksFrom(`${GUIDE}commands.html`).filter((link) => link.path === "/guide/configuration");
    expect(toConfiguration.length).toBeGreaterThan(0);
    expect(toConfiguration.filter((link) => link.hash === "")).toEqual([]);
  });

  test("the Extension page links to Watching and Socket IPC links to Runtime", () => {
    expect(has(linksFrom("vscode/extension.html"), "/guide/runtime", "watching")).toBe(true);
    expect(has(linksFrom("vscode/socket-ipc.html"), "/guide/runtime")).toBe(true);
  });
});

describe("configuration keys are links", () => {
  const targets = (): Map<string, string> => {
    const found = new Map<string, string>();
    for (const [file, prefix] of [
      ["guide/configuration.html", "/guide/configuration"],
      ["chat-renamer/configuration.html", "/chat-renamer/configuration"],
    ] as const) {
      for (const heading of headingsOf(page(file))) {
        if (/^(db|variant|chatRenamer)\.\S+$/.test(heading.text)) found.set(heading.text, `${prefix}#${heading.id}`);
      }
    }
    return found;
  };

  /** The inline code of a built page body outside headings and fenced code: text, and the link it sits in. */
  const mentions = (path: string): { text: string; href: string | undefined }[] => {
    const html = bodyOf(page(path))
      .replace(/<pre[\s\S]*?<\/pre>/g, "")
      .replace(/<h[1-6][\s\S]*?<\/h[1-6]>/g, "");
    return [...html.matchAll(/<code[^>]*>([\s\S]*?)<\/code>/g)].map((match) => {
      const before = html.slice(0, match.index);
      const anchor = /<a\b[^>]*?\shref="([^"]*)"[^>]*>\s*$/.exec(before);
      const closes = html.slice(match.index + match[0].length).startsWith("</a>");
      const href = anchor && closes ? new URL(decodeEntities(anchor[1]), `https://docs.test/${path}`) : undefined;
      return {
        text: decodeEntities(match[1].replace(/<[^>]+>/g, "")).trim(),
        href: href ? `${href.pathname.replace(/\.html$/, "")}${href.hash}` : undefined,
      };
    });
  };

  const docPages = () => builtPages().filter((file) => file !== "404.html");

  test("each mention of a key with a heading is the content of a link to that heading", () => {
    const keys = targets();
    expect(keys.size).toBeGreaterThan(40);
    const unlinked: string[] = [];
    for (const file of docPages()) {
      for (const mention of mentions(file)) {
        const target = keys.get(mention.text);
        if (target && mention.href !== target) unlinked.push(`${file}: ${mention.text} (${mention.href ?? "no link"})`);
      }
    }
    expect(unlinked).toEqual([]);
  });

  test("Overview, Runtime, Commands, Library and Extension each have a linked mention", () => {
    const keys = targets();
    for (const file of ["guide/overview", "guide/runtime", "guide/commands", "development/library", "vscode/extension"].map((name) => `${name}.html`)) {
      expect(
        mentions(file).filter((mention) => keys.has(mention.text) && mention.href === keys.get(mention.text)).length,
        file,
      ).toBeGreaterThan(0);
    }
  });

  test("the Chat Renamer overview links chatRenamer.trigger to the Chat Renamer configuration", () => {
    const trigger = mentions("chat-renamer/index.html").filter((mention) => mention.text === "chatRenamer.trigger");
    expect(trigger.length).toBeGreaterThan(0);
    expect(trigger.every((mention) => mention.href === "/chat-renamer/configuration#chatrenamer-trigger")).toBe(true);
  });
});

describe("overview steps are short and link to commands", () => {
  const overview = () => page("guide/overview.html");

  for (const command of ["create", "provision", "watch", "down", "deprovision", "implode"]) {
    test(`the ${command} step is a short explanation that ends with a link to its Commands section`, () => {
      const section = sectionOf(overview(), command);
      expect(section, "no list, table or fenced code").not.toMatch(/<(ul|ol|table|pre)\b|class="language-/);
      const paragraphs = [...section.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => match[1]);
      const last = paragraphs.at(-1) ?? "";
      const sentence = `More details at Commands ${command}.`;
      expect(decodeEntities(last.replace(/<[^>]+>/g, "")).trim().endsWith(sentence), "ends the last paragraph").toBe(true);
      expect(linksOf(last.slice(last.lastIndexOf("More details at Commands")), "guide/overview.html")).toEqual([
        { path: "/guide/commands", hash: command },
      ]);
      const explanation = [...paragraphs.slice(0, -1), last.slice(0, last.lastIndexOf("More details at Commands"))].join(" ");
      expect(wordsIn(explanation)).toBeLessThanOrEqual(60);
      expect(wordsIn(explanation)).toBeGreaterThan(0);
      expect(decodeEntities(explanation.replace(/<[^>]+>/g, ""))).not.toMatch(/(^|\s)--?[a-z]/);
    });
  }

  test("the seed step keeps its explanation and example, links its keys and has no Commands link", () => {
    const section = sectionOf(overview(), "seed");
    expect(section).toContain("language-yaml");
    expect(section).not.toContain("More details at");
    const links = linksOf(section, "guide/overview.html").map((link) => `${link.path}#${link.hash}`);
    expect(links).toContain("/guide/configuration#variant-steps");
  });

  test("Custom Steps and Custom multi-tenancy steps keep their examples; the second links db.multi", () => {
    expect(sectionOf(overview(), "custom-steps")).toContain("language-yaml");
    const multi = sectionOf(overview(), "custom-multi-tenancy-steps");
    expect(multi).toContain("language-yaml");
    const links = linksOf(multi, "guide/overview.html").map((link) => `${link.path}#${link.hash}`);
    expect(links).toContain("/guide/configuration#db-multi");
    expect(links).toContain("/guide/configuration#db-multi-schemaprefix");
  });

  test("Commands carries what the Overview dropped", () => {
    const core = page("guide/commands.html");
    for (const command of ["provision", "deprovision"]) {
      const links = linksOf(sectionOf(core, command), "guide/commands.html").map((link) => `${link.path}#${link.hash}`);
      expect(links, command).toContain("/guide/configuration#variant-steps");
      expect(links, command).toContain("/guide/configuration#db-multi");
    }
    expect(decodeEntities(sectionOf(core, "watch").replace(/<[^>]+>/g, ""))).toContain("--reprovision");
  });
});

describe("library page links into Commands and Configuration", () => {
  const library = () => page("development/library.html");

  test("shows createVariantClient code and links to Commands", () => {
    expect(bodyOf(library())).toContain("createVariantClient");
    expect(bodyOf(library())).toContain("language-");
    expect(linksOf(bodyOf(library()), "development/library.html").some((link) => link.path === "/guide/commands")).toBe(true);
  });

  test("its Configuration section is deep links and has no code block", () => {
    const section = sectionOf(library(), "configuration");
    expect(section).not.toMatch(/<pre\b|class="language-/);
    const links = linksOf(section, "development/library.html").map((link) => `${link.path}#${link.hash}`);
    for (const target of ["variant-watches", "variant-steps", "variant-mise"]) {
      expect(links).toContain(`/guide/configuration#${target}`);
    }
  });
});

describe("follow-up edits of the pages", () => {
  test("the MCP page has no Testing section", () => {
    expect(headingsOf(page("vscode/mcp.html")).map((heading) => heading.text)).not.toContain("Testing");
  });

  test("Commands groups the lifecycle commands and the other commands", () => {
    const headings = headingsOf(page("guide/commands.html")).filter((heading) => heading.level <= 3);
    expect(headings.filter((heading) => heading.level === 2).map((heading) => heading.text)).toEqual([
      "Lifecycle commands",
      "Other commands",
    ]);
    const below = (group: string) => {
      const start = headings.findIndex((heading) => heading.text === group);
      const rest = headings.slice(start + 1);
      const end = rest.findIndex((heading) => heading.level === 2);
      return (end === -1 ? rest : rest.slice(0, end)).map((heading) => heading.text);
    };
    const withoutInit = (names: string[]) => names.filter((name) => name !== "init");
    expect(withoutInit(below("Lifecycle commands"))).toEqual([
      "create",
      "provision",
      "up",
      "watch",
      "down",
      "deprovision",
      "implode",
    ]);
    expect(withoutInit(below("Other commands"))).toEqual(["config", "list", "status", "ui", "mcp"]);
  });

  test("the activationPatterns section lists the default patterns of chat-renamer-config", () => {
    const section = sectionOf(page("chat-renamer/configuration.html"), "chatrenamer-activationpatterns");
    const blocks = [...section.matchAll(/<pre[\s\S]*?<\/pre>/g)].map((match) => decodeEntities(match[0].replace(/<[^>]+>/g, "")));
    expect(blocks.length).toBeGreaterThan(0);
    const parsed = (globalThis as unknown as { Bun: { YAML: { parse: (text: string) => unknown } } }).Bun.YAML.parse(blocks[0]);
    expect(parsed).toEqual({ chatRenamer: { activationPatterns: [...DEFAULT_ACTIVATION_PATTERNS] } });
  });

  test("the Up section goes through create, provision and seed like watch and holds an info panel", () => {
    const up = sectionOf(page("guide/runtime.html"), "up");
    const text = decodeEntities(up.replace(/<[^>]+>/g, " "));
    for (const step of ["create", "provision", "seed"]) expect(text, step).toContain(step);
    expect(text).not.toMatch(/recreates the database/);
    expect(up).toMatch(/class="info custom-block"/);
    expect(up).toContain("not thoroughly tested");
  });
});

describe("README links into the documentation site", () => {
  const ids = (file: string) => new Set([...page(file).matchAll(/\s(?:id|name)="([^"]*)"/g)].map((match) => match[1]));

  test("every link to the site names a built page and, with a fragment, an id of it", () => {
    const dead: string[] = [];
    let seen = 0;
    for (const readme of READMES) {
      for (const link of readmeLinks(readFileSync(join(root, readme), "utf8"))) {
        if (!link.url.startsWith(SITE)) continue;
        seen++;
        const [path, hash] = decodeURIComponent(link.url.slice(SITE.length)).split("#");
        const file = path === "" || path.endsWith("/") ? `${path}index.html` : /\.[a-z0-9]+$/i.test(path) ? path : `${path}.html`;
        if (!existsSync(join(dist, file))) dead.push(`${readme}:${link.line} ${link.url}`);
        else if (hash && file.endsWith(".html") && !ids(file).has(hash)) dead.push(`${readme}:${link.line} ${link.url}`);
      }
    }
    expect(seen).toBeGreaterThan(8);
    expect(dead).toEqual([]);
  });
});
