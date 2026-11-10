import esbuild from "esbuild";
import { bundleWebview } from "./bundle-webview";
import config, { mcpBundle, watchRelayBundle } from "./esbuild.config";

esbuild
  .build(config)
  .then(() => esbuild.build(mcpBundle))
  .then(() => esbuild.build(watchRelayBundle))
  .then(() => bundleWebview())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
