/**
 * Compile the `variant` CLI, with the variants app embedded, to a single-file executable (bun build --compile).
 *
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release contents)
 *
 * Usage: bun scripts/package-cli.ts [bun-target|all]   (default: the host platform)
 * Output: out/variant-<version>-<os>-<arch>[.exe]
 */
import { accessSync, constants, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSlimRuntimeFor, slimRuntimeRelease } from "./bun-slim.ts";
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

/** The bun targets to compile for `arg`: one target, or `all` release platforms. */
export const compileTargets = (arg: string, env: NodeJS.ProcessEnv = process.env): readonly string[] => {
  if (arg === "all" && env.VARIANT_BUN_RUNTIME) {
    throw new Error("VARIANT_BUN_RUNTIME fits one platform; unset it to compile every release platform");
  }
  return arg === "all" ? RELEASE_TARGETS : [arg];
};

export const hostTarget = (): string => `bun-${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;

const isExecutableFile = (path: string): boolean => {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** The runtime executable named by `VARIANT_BUN_RUNTIME`, when the caller supplied one. */
export const runtimeExecutable = (env: NodeJS.ProcessEnv = process.env): string | undefined => {
  const runtime = env.VARIANT_BUN_RUNTIME || undefined;
  if (runtime !== undefined && !isExecutableFile(runtime)) {
    throw new Error(`VARIANT_BUN_RUNTIME is not an executable file: ${runtime}`);
  }
  return runtime;
};

/** The runtime a compile embeds: a given executable, or none for the default Bun runtime. `build` is its jubr/bun-slim build. */
export interface RuntimeChoice {
  executablePath?: string;
  source: "external" | "slim" | "default";
  build?: string;
}

/** Reports a choice (`info`) or a fallback (`warn`) before the compile. */
export type Say = (level: "info" | "warn", message: string) => void;

const repositoryRoot = resolve(import.meta.dir, "..");

const sayOnStderr: Say = (level, message) => {
  console.error(level === "warn" && process.env.GITHUB_ACTIONS === "true" ? `::warning::${message}` : `${level}: ${message}`);
};

/**
 * The runtime to embed for `target`, and a line saying which and why. In order: the executable `VARIANT_BUN_RUNTIME` names,
 * the slim runtime fetched from jubr/bun-slim (Linux and macOS), the default Bun runtime (`bun-dist`; information for
 * Windows, which has no slim runtime, a warning with the reason when a fetch failed).
 */
export const selectRuntime = (
  target: string,
  options: { env?: NodeJS.ProcessEnv; fetchSlim?: (platform: string) => string; say?: Say } = {},
): RuntimeChoice => {
  const { env = process.env, fetchSlim = (platform) => fetchSlimRuntimeFor(repositoryRoot, platform), say = sayOnStderr } = options;
  const withBuild = (choice: RuntimeChoice, executable: string): RuntimeChoice => {
    const release = slimRuntimeRelease(executable);
    return release === undefined ? choice : { ...choice, build: release.build };
  };
  const external = runtimeExecutable(env);
  if (external !== undefined) {
    say("info", `${target}: runtime from VARIANT_BUN_RUNTIME: ${external}`);
    return withBuild({ executablePath: external, source: "external" }, external);
  }
  const [, os, arch] = target.split("-");
  if (os === "windows") {
    say("info", `${target}: runtime bun-dist, the default Bun runtime (Windows has no slim runtime)`);
    return { source: "default" };
  }
  try {
    const executable = fetchSlim(`${os}-${arch}`);
    const choice = withBuild({ executablePath: executable, source: "slim" }, executable);
    const release = slimRuntimeRelease(executable);
    const name = release === undefined ? "the slim runtime" : `bun-slim-v${release.version}-${release.build}`;
    say("info", `${target}: runtime ${name} fetched from jubr/bun-slim: ${executable}`);
    return choice;
  } catch (error) {
    const reason = (error instanceof Error ? error.message : String(error)).split("\n")[0];
    say("warn", `${target}: no slim runtime (${reason}); runtime bun-dist, the default Bun runtime`);
    return { source: "default" };
  }
};

/** `VARIANT_BUILD_RUNTIME`: the jubr/bun-slim build number the version line shows after the runtime's Bun version. */
export const runtimeDefines = (runtime: RuntimeChoice): Record<string, string> =>
  runtime.build === undefined ? {} : { VARIANT_BUILD_RUNTIME: JSON.stringify(runtime.build) };

/** The module that stands in for `embedded-app.ts` beside `variant-cli/bundle` in a compiled executable. */
export const embeddedAppModule = (appDirectory: string): string => {
  const files = readdirSync(appDirectory).filter((name) => statSync(join(appDirectory, name)).isFile());
  return [
    ...files.map((name, index) => `import file${index} from ${JSON.stringify(join(appDirectory, name))} with { type: "file" };`),
    `export const embeddedApp = { ${files.map((name, index) => `${JSON.stringify(name)}: file${index}`).join(", ")} };`,
  ].join("\n");
};

/**
 * Compile the CLI, with the built variants app (`packages/variant-cli/dist/ui`) embedded, to a single-file executable
 * at `outfile`; `target` is a bun target, the host platform by default. `runtime` is the choice of `selectRuntime`;
 * without it the runtime is the executable `VARIANT_BUN_RUNTIME` names in `env`, else the default one, and nothing is fetched.
 */
export const compileCli = async (
  root: string,
  outfile: string,
  target?: string,
  env: NodeJS.ProcessEnv = process.env,
  runtime?: RuntimeChoice,
): Promise<string> => {
  const given = runtimeExecutable(env);
  const choice: RuntimeChoice =
    runtime ?? (given === undefined ? { source: "default" } : { executablePath: given, source: "external" });
  const { executablePath } = choice;
  const appDirectory = join(root, "packages/variant-cli/dist/ui");
  if (!existsSync(join(appDirectory, "index.html"))) {
    throw new Error(`the variants app is not built: ${appDirectory}/index.html is missing (run task build)`);
  }
  const entry = realpathSync(fileURLToPath(import.meta.resolve("variant-cli/bundle")));
  const placeholder = realpathSync(
    fileURLToPath(new URL("./embedded-app.ts", import.meta.resolve("variant-cli/bundle"))),
  );
  const result = await Bun.build({
    entrypoints: [entry],
    compile: {
      outfile,
      ...(target === undefined ? {} : { target: target as Bun.Build.Target }),
      ...(executablePath === undefined ? {} : { executablePath }),
    },
    define: { ...versionDefines(root), ...runtimeDefines(choice) },
    plugins: [
      {
        name: "embed-variants-app",
        setup: (build) => {
          build.onLoad({ filter: /embedded-app\.ts$/ }, (args) =>
            realpathSync(args.path) === placeholder
              ? { contents: embeddedAppModule(appDirectory), loader: "ts" }
              : undefined,
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
  const targets = compileTargets(arg);
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version as string;

  mkdirSync(join(root, "out"), { recursive: true });
  for (const target of targets) {
    const runtime = selectRuntime(target);
    console.log(await compileCli(root, join(root, "out", assetName(version, target)), target, process.env, runtime));
  }
}
