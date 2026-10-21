import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type HeadConfig } from "vitepress";

const packageVersion = (
  JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json"), "utf8")) as {
    version: string;
  }
).version;

const pagesBase = "/variant-worktrees/";

const withPagesBase = (head: HeadConfig[]): HeadConfig[] => {
  for (const tag of head) {
    const attrs = tag[1];
    if (!attrs) continue;
    for (const key of ["href", "src"] as const) {
      const value = attrs[key];
      if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) continue;
      if (value.startsWith(pagesBase)) continue;
      attrs[key] = `${pagesBase}${value.slice(1)}`;
    }
  }
  return [];
};

export default defineConfig({
  title: "variant-worktrees",
  description:
    "Manages git worktrees, database schemas, watches, environment variables, and implodes. CLI, MCP server, VS Code extension, and library.",
  base: pagesBase,
  transformHead({ head }) {
    return withPagesBase(head);
  },

  head: [
    ["link", { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" }],
    ["link", { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
        rel: "stylesheet",
      },
    ],
  ],

  appearance: "dark",

  themeConfig: {
    logo: "/logo-256.png",
    search: { provider: "local" },
    nav: [
      { text: "Guide", link: "/guide/", activeMatch: "^/guide/" },
      { text: "Configuration", link: "/guide/configuration" },
      { text: "CLI", link: "/cli-vscode-webview#cli" },
      { text: "MCP", link: "/mcp", activeMatch: "^/mcp" },
      { text: `v${packageVersion}`, link: "https://github.com/jubr/variant-worktrees/releases" },
    ],

    sidebar: [
      { text: "Getting Started", link: "/guide/" },
      {
        text: "Variant Worktrees",
        items: [
          { text: "Core", link: "/guide/core" },
          { text: "Configuration", link: "/guide/configuration" },
          { text: "Installation", link: "/guide/installation" },
          { text: "Editor socket", link: "/guide/ipc" },
          { text: "MCP Server", link: "/mcp" },
          { text: "Library", link: "/guide/library" },
        ],
      },
      {
        text: "Chat Renamer",
        items: [
          { text: "Overview", link: "/chat-renamer/" },
          { text: "Configuration", link: "/chat-renamer/configuration" },
        ],
      },
      {
        text: "Development",
        items: [
          { text: "Building", link: "/development/building" },
          { text: "API Reference", link: "/api/" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/jubr/variant-worktrees" }],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Built for variant-worktrees.",
    },
  },
});
