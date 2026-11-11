import type { BuildOptions } from "esbuild";

const config: BuildOptions = {
  entryPoints: ["./src/extension.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  outdir: "./dist",
  outbase: "./src",
  outExtension: {
    ".js": ".cjs",
  },
  format: "cjs",
  // AIDEV-NOTE: variant-api reads sqlite through a runtime-specific module. It stays external so the bundle builds; the
  // extension loads variant-api lazily and shows an error in the view where that module is missing.
  // AIDEV-NOTE: since variant-api picks its sqlite driver at run time (node:sqlite on Node 22.13+), `bun:sqlite` here is only
  // a safety net; the lazy import stays so an older host gets an error in the view.
  external: ["vscode", "bun:sqlite"],
  // AIDEV-NOTE: a CommonJS bundle has no `import.meta`, and esbuild leaves `import.meta.url` undefined; dependencies such
  // as fdir (through variant-api's glob) pass it to `createRequire` when they load. It is the bundle's own file URL.
  define: { "import.meta.url": "__importMetaUrl" },
  banner: { js: 'const __importMetaUrl = require("node:url").pathToFileURL(__filename).href;' },
  loader: {
    ".ts": "ts",
    ".js": "js",
  },
  logLevel: "info",
};

/** A spawnable relay. The extension bundle looks for this file beside `extension.cjs`. */
export const watchRelayBundle: BuildOptions = {
  entryPoints: ["../variant-api/src/watch-relay.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "./dist/watch-relay.js",
  external: ["bun:sqlite"],
  // AIDEV-NOTE: yaml's CJS build calls require("process"). An ESM bundle has no require unless this banner creates one.
  banner: {
    js: 'import { createRequire as __relayCreateRequire } from "node:module"; const require = __relayCreateRequire(import.meta.url);',
  },
  logLevel: "info",
};

export const mcpBundle: BuildOptions = {
  entryPoints: ["./src/mcp-entry.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "./dist/mcp.mjs",
  external: ["bun:sqlite"],
  // AIDEV-NOTE: yaml's CJS build calls require("process"). An ESM bundle has no require unless this banner creates one.
  banner: {
    js: 'import { createRequire as __mcpCreateRequire } from "node:module"; const require = __mcpCreateRequire(import.meta.url);',
  },
  logLevel: "info",
};

export default config;
