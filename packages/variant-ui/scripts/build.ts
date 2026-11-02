import { rmSync } from "node:fs";
import { join } from "node:path";

/** Bundles `src/index.html` with its script, styles and the codicon font into a static directory. */
export const buildApp = async (outdir: string): Promise<void> => {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "../src/index.html")],
    outdir,
    target: "browser",
    minify: true,
    sourcemap: "none",
  });
  if (!result.success) {
    throw new Error(result.logs.map((log) => log.message).join("\n"));
  }
};

if (import.meta.main) {
  const outdir = join(import.meta.dir, "../dist");
  rmSync(outdir, { recursive: true, force: true });
  await buildApp(outdir);
}
