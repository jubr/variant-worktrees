/**
 * Builds the variants app into `dist/ui`, where `variant ui` serves it from: the app ships inside this package.
 *
 * Specification: openspec/specs/variant-cli/package/spec.md (The UI server is part of the CLI)
 */
import { join } from "node:path";
import { buildApp } from "variant-ui/build";

const outdir = join(import.meta.dir, "../dist/ui");
await Bun.$`rm -rf ${outdir}`;
await buildApp(outdir);
