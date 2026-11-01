import { rmSync } from "node:fs";
import { join } from "node:path";
import { buildApp } from "variant-ui/build";

/** The directory of the extension that holds the variants app, which the panel loads into its webview. */
export const WEBVIEW_DIRECTORY = join(import.meta.dir, "../dist/webview");

/** Builds the variants app into `outdir`, replacing what was there. */
export const bundleWebview = async (outdir: string = WEBVIEW_DIRECTORY): Promise<void> => {
  rmSync(outdir, { recursive: true, force: true });
  await buildApp(outdir);
};
