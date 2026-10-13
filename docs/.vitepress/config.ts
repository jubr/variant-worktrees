import { defineConfig } from "vitepress";

export default defineConfig({
  title: "variant-worktrees",
  description: "Typed database variants through the Variant API, CLI, and MCP server.",
  base: "/",

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

  themeConfig: {
    logo: "/logo-256.png",
    nav: [
      { text: "Library", link: "/guide/library" },
      { text: "MCP Server", link: "/mcp" },
      { text: "API Reference", link: "/api/" },
    ],

    sidebar: {
      "/guide/library": [
        {
          text: "Getting Started",
          items: [
            { text: "Installation", link: "/guide/installation" },
            { text: "Quick Start", link: "/guide/library" },
          ],
        },
        {
          text: "API",
          items: [{ text: "Lifecycle", link: "/guide/library#lifecycle" }],
        },
      ],
      "/mcp": [
        {
          text: "Setup",
          items: [{ text: "Configuration", link: "/mcp#setup" }],
        },
        {
          text: "Tools",
          items: [{ text: "Variant tools", link: "/mcp#available-tools" }],
        },
      ],
      "/": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/guide/" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Library", link: "/guide/library" },
            { text: "Editor socket", link: "/guide/ipc" },
            { text: "MCP Server", link: "/mcp" },
          ],
        },
        { text: "API Reference", link: "/api/" },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/jubr/variant-worktrees" }],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Built for variant-worktrees.",
    },
  },
});
