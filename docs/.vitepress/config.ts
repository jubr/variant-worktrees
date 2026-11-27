import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type HeadConfig } from "vitepress";

const packageVersion = (
  JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json"), "utf8")) as {
    version: string;
  }
).version;

// AIDEV-NOTE: a relative base makes the built site relocatable; VitePress emits `head` entries as written, so favicons are added per page below
const faviconHeads = (relativePath: string): HeadConfig[] => {
  const prefix = "../".repeat(relativePath.split("/").length - 1) || "./";
  return [
    ["link", { rel: "icon", type: "image/png", sizes: "32x32", href: `${prefix}favicon-32.png` }],
    ["link", { rel: "icon", type: "image/png", sizes: "16x16", href: `${prefix}favicon-16.png` }],
  ];
};

export default defineConfig({
  title: "variant-worktrees",
  description:
    "Manages git worktrees, database schemas, watches, environment variables, and implodes. CLI, MCP server, VS Code extension, and library.",
  base: "./",
  vite: { clearScreen: false },
  markdown: {
    // AIDEV-NOTE: on the Configuration page a plain `---` between two options renders as the tighter hr.option-sep (see custom.css)
    config(md) {
      const rule = md.renderer.rules.hr;
      md.renderer.rules.hr = (tokens, index, options, env, self) =>
        (env as { relativePath?: string }).relativePath === "guide/configuration.md"
          ? '<hr class="option-sep">\n'
          : rule
            ? rule(tokens, index, options, env, self)
            : self.renderToken(tokens, index, options);
    },
  },
  transformHead({ pageData }) {
    return faviconHeads(pageData.relativePath);
  },

  head: [
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
    outline: { level: [2, 3] },
    nav: [
      { text: "Configuration", link: "/guide/configuration" },
      { text: "CLI", link: "/guide/cli" },
      { text: "MCP", link: "/vscode/mcp" },
      { text: `v${packageVersion}`, link: "https://github.com/jubr/variant-worktrees/releases" },
    ],

    sidebar: [
      { text: "Getting Started", link: "/" },
      {
        text: "Variant Worktrees",
        items: [
          { text: "Overview", link: "/guide/overview" },
          { text: "Installation", link: "/guide/installation" },
          { text: "Commands", link: "/guide/commands" },
          { text: "Configuration", link: "/guide/configuration" },
          { text: "CLI", link: "/guide/cli" },
          { text: "Database", link: "/guide/database" },
          { text: "Runtime", link: "/guide/runtime" },
          { text: "Workspace", link: "/guide/workspace" },
        ],
      },
      {
        text: "VSCode / Cursor",
        items: [
          { text: "Extension", link: "/vscode/extension" },
          { text: "MCP Server", link: "/vscode/mcp" },
          { text: "Socket IPC", link: "/vscode/socket-ipc" },
        ],
      },
      {
        text: "Chat Renamer",
        items: [
          { text: "Extension", link: "/chat-renamer/" },
          { text: "Configuration", link: "/chat-renamer/configuration" },
        ],
      },
      {
        text: "Development",
        items: [
          { text: "Building", link: "/development/building" },
          { text: "Bun standalone slim", link: "/development/bun-standalone-slim" },
          { text: "Library", link: "/development/library" },
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
