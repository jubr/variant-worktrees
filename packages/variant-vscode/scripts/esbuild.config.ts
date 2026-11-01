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
  loader: {
    ".ts": "ts",
    ".js": "js",
  },
  logLevel: "info",
};

export default config;
