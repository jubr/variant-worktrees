import esbuild from "esbuild";
import { bundleWebview } from "./bundle-webview";
import config, { mcpBundle } from "./esbuild.config";

esbuild
  .build(config)
  .then(() => esbuild.build(mcpBundle))
  .then(() => bundleWebview())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
