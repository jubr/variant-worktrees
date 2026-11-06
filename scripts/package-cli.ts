/**
 * Compile the `variant` CLI, with the variants app embedded, to a single-file executable (bun build --compile).
 *
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release contents)
 *
 * Usage: bun scripts/package-cli.ts [bun-target|all]   (default: the host platform)
 * Output: out/variant-<version>-<os>-<arch>[.exe]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { versionDefines } from "./version-stamp.ts";

/** Platforms a release ships a `variant` executable for. */
export const RELEASE_TARGETS = [
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-darwin-x64",
  "bun-darwin-arm64",
  "bun-windows-x64",
  "bun-windows-arm64",
] as const;

/** `bun-<os>-<arch>` target to the asset file name `variant-<version>-<os>-<arch>[.exe]`. */
export const assetName = (version: string, target: string): string => {
  if (!(RELEASE_TARGETS as readonly string[]).includes(target)) {
    throw new Error(`unsupported target: ${target} (expected one of ${RELEASE_TARGETS.join(", ")})`);
  }
  const [, os, arch] = target.split("-");
  return `variant-${version}-${os}-${arch}${os === "windows" ? ".exe" : ""}`;
};

const hostTarget = (): string => `bun-${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;

/** The module that stands in for `packages/variant-cli/src/embedded-app.ts` in a compiled executable. */
export const embeddedAppModule = (appDirectory: string): string => {
  const files = readdirSync(appDirectory).filter((name) => statSync(join(appDirectory, name)).isFile());
  return [
    ...files.map((name, index) => `import file${index} from ${JSON.stringify(join(appDirectory, name))} with { type: "file" };`),
    `export const embeddedApp = { ${files.map((name, index) => `${JSON.stringify(name)}: file${index}`).join(", ")} };`,
  ].join("\n");
};

/**
 * Compile the CLI, with the built variants app (`packages/variant-cli/dist/ui`) embedded, to a single-file executable
 * at `outfile`; `target` is a bun target, the host platform by default.
 */
export const compileCli = async (root: string, outfile: string, target?: string): Promise<string> => {
  const appDirectory = join(root, "packages/variant-cli/dist/ui");
  if (!existsSync(join(appDirectory, "index.html"))) {
    throw new Error(`the variants app is not built: ${appDirectory}/index.html is missing (run task build)`);
  }
  const placeholder = join(root, "packages/variant-cli/src/embedded-app.ts");
  const result = await Bun.build({
    entrypoints: [join(root, "packages/variant-cli/src/cli.ts")],
    compile: target === undefined ? { outfile } : { outfile, target: target as Bun.Build.Target },
    define: versionDefines(root),
    plugins: [
      {
        name: "embed-variants-app",
        setup: (build) => {
          build.onLoad({ filter: /embedded-app\.ts$/ }, (args) =>
            args.path === placeholder ? { contents: embeddedAppModule(appDirectory), loader: "ts" } : undefined,
          );
        },
      },
    ],
  });
  if (!result.success) {
    throw new Error(result.logs.map((log) => log.message).join("\n"));
  }
  return outfile;
};

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..");
  const arg = process.argv[2] ?? hostTarget();
  const targets = arg === "all" ? RELEASE_TARGETS : [arg];
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version as string;

  mkdirSync(join(root, "out"), { recursive: true });
  for (const target of targets) {
    console.log(await compileCli(root, join(root, "out", assetName(version, target)), target));
  }
}
