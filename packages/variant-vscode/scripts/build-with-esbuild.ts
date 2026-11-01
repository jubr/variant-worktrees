import esbuild from "esbuild";
import { bundleWebview } from "./bundle-webview";
import config from "./esbuild.config";

esbuild
  .build(config)
  .then(() => bundleWebview())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
