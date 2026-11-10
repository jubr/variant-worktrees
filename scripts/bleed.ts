/**
 * Publish host executables into `vw-bleeds` beside the checkout.
 *
 * Specification: openspec/specs/meta/dev-bleeds/spec.md
 */
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { compileCli } from "./package-cli.ts";
import { bleedDirectory } from "./package-vsix-unpacked.ts";

/** Replace `vw-bleeds/<product>` with `bin/<name>` after `compile` writes the executable. */
const publishBinary = async (
  cwd: string,
  product: string,
  name: string,
  compile: (outfile: string) => Promise<void>,
): Promise<string> => {
  const staging = mkdtempSync(join(tmpdir(), "bleed-bin-"));
  const outfile = join(staging, name);
  try {
    await compile(outfile);
    if (!existsSync(outfile)) {
      throw new Error("compile produced no executable");
    }
    const destination = join(bleedDirectory(cwd), product);
    const bin = join(destination, "bin", name);
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(join(destination, "bin"), { recursive: true });
    cpSync(outfile, bin);
    chmodSync(bin, 0o755);
    return bin;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
};

/** Publish a host compile of `variant` beside the checkout. */
export const publishCli = (cwd: string, compile: (outfile: string) => Promise<void>): Promise<string> =>
  publishBinary(cwd, "variant-cli", "variant", compile);

/** Publish a host compile of `variant-mcp` beside the checkout. */
export const publishMcp = (cwd: string, compile: (outfile: string) => Promise<void>): Promise<string> =>
  publishBinary(cwd, "variant-mcp", "variant-mcp", compile);

/** Compile the host `variant` executable and publish it beside the checkout. */
export const bleedCli = (cwd: string): Promise<string> =>
  publishCli(cwd, async (outfile) => {
    await compileCli(cwd, outfile);
  });

/** Compile `variant-mcp` for the host with its dependencies included. */
export const compileMcp = async (root: string, outfile: string): Promise<string> => {
  const entry = realpathSync(fileURLToPath(import.meta.resolve("variant-mcp/bundle")));
  if (!entry.startsWith(`${realpathSync(root)}${sep}`)) {
    throw new Error(`variant-mcp entry is missing: ${entry}`);
  }
  const version = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.resolve("variant-mcp/bundle")), "utf8"),
  ).version as string;
  const result = await Bun.build({
    entrypoints: [entry],
    compile: { outfile },
    plugins: [
      {
        name: "embed-mcp-version",
        setup: (build) => {
          build.onLoad({ filter: /mcp\.ts$/ }, (args) => {
            if (realpathSync(args.path) !== entry) {
              return undefined;
            }
            const source = readFileSync(args.path, "utf8").replace(
              'const { version } = require("../package.json") as { version: string };',
              `const version = ${JSON.stringify(version)};`,
            );
            return { contents: source, loader: "ts" };
          });
        },
      },
    ],
  });
  if (!result.success) {
    throw new Error(result.logs.map((log) => log.message).join("\n"));
  }
  return outfile;
};

/** Compile the host `variant-mcp` executable and publish it beside the checkout. */
export const bleedMcp = (cwd: string): Promise<string> =>
  publishMcp(cwd, async (outfile) => {
    await compileMcp(cwd, outfile);
  });

if (import.meta.main) {
  const command = process.argv[2];
  const cwd = resolve(import.meta.dir, "..");
  try {
    if (command === "cli") {
      console.log(await bleedCli(cwd));
    } else if (command === "mcp") {
      console.log(await bleedMcp(cwd));
    } else {
      throw new Error("usage: bun scripts/bleed.ts cli|mcp");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
