/**
 * Bundle `variant-cli` with the build date and `variant` string baked in.
 * Specification: openspec/specs/variant-api/commands/spec.md
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { versionDefines } from "./version-stamp.ts";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "../packages/variant-cli");
const result = await Bun.build({
  entrypoints: [join(packageDir, "src/cli.ts")],
  outdir: join(packageDir, "dist"),
  target: "node",
  format: "esm",
  sourcemap: "external",
  external: ["cleye", "variant-api", "variant-config", "yaml"],
  define: versionDefines(join(packageDir, "../..")),
});

if (!result.success) {
  throw new Error(result.logs.map((log) => log.message).join("\n"));
}
