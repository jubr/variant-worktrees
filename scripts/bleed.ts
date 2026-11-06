/**
 * Publish host executables into `vw-bleeds` beside the checkout.
 *
 * Specification: openspec/specs/meta/dev-bleeds/spec.md
 */
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileCli } from "./package-cli.ts";
import { bleedDirectory } from "./package-vsix-unpacked.ts";

/** Replace `vw-bleeds/<product>` with `bin/<name>` after `compile` writes the executable. */
export const publishCli = async (cwd: string, compile: (outfile: string) => Promise<void>): Promise<string> => {
  const staging = mkdtempSync(join(tmpdir(), "bleed-cli-"));
  const outfile = join(staging, "variant");
  try {
    await compile(outfile);
    if (!existsSync(outfile)) {
      throw new Error("compile produced no executable");
    }
    const destination = join(bleedDirectory(cwd), "variant-cli");
    const bin = join(destination, "bin", "variant");
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(join(destination, "bin"), { recursive: true });
    cpSync(outfile, bin);
    chmodSync(bin, 0o755);
    return bin;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
};

/** Compile the host `variant` executable and publish it beside the checkout. */
export const bleedCli = (cwd: string): Promise<string> =>
  publishCli(cwd, async (outfile) => {
    await compileCli(cwd, outfile);
  });
