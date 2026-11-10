import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import esbuild, { type BuildOptions } from "esbuild";

/**
 * Specification: openspec/specs/variant-vscode/mcp-registration/spec.md
 */
describe("bundled MCP server", () => {
  const buildModule = async (): Promise<{ default: BuildOptions; mcpBundle?: BuildOptions }> =>
    import("../scripts/esbuild.config.ts");

  it("exports an ESM bundle for dist/mcp.mjs and keeps the extension bundle CommonJS", async () => {
    const builds = await buildModule();

    expect(builds.default.format).toBe("cjs");
    expect(builds.default.banner?.js).toContain("__importMetaUrl");
    expect(builds.mcpBundle).toMatchObject({
      format: "esm",
      target: "node22",
      bundle: true,
      outfile: "./dist/mcp.mjs",
      external: ["bun:sqlite"],
    });
    expect(builds.mcpBundle?.banner?.js).not.toContain("__importMetaUrl");
    expect(builds.mcpBundle?.define?.["import.meta.url"]).toBeUndefined();
    expect(builds.mcpBundle?.entryPoints).toEqual(["./src/mcp-entry.ts"]);
  });

  it("starts the existing server in --cwd and leaves the process directory alone without it", async () => {
    const builds = await buildModule();
    expect(builds.mcpBundle?.entryPoints).toEqual(["./src/mcp-entry.ts"]);
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-mcp-entry-")));
    const elsewhere = realpathSync(mkdtempSync(join("/tmp", "variant-mcp-entry-cwd-")));
    const configPath = join(directory, "variants.yaml");
    const outfile = join(elsewhere, "dist", "mcp.mjs");
    writeFileSync(configPath, "db:\n  dialect: sqlite\n  colour: red\n");
    writeFileSync(join(elsewhere, "package.json"), JSON.stringify({ version: "0.0.0" }));
    mkdirSync(join(elsewhere, "dist"));
    try {
      await buildBundle(builds.mcpBundle as BuildOptions, outfile);
      const flagged = await talk(outfile, elsewhere, ["--cwd", directory]);
      expect(flagged.names).toContain("variant_list");
      expect(flagged.names).not.toContain("variant_destroy");
      expect(flagged.config.warnings).toEqual([`${configPath}: unknown key db.colour`]);

      const plain = await talk(outfile, directory, []);
      expect(plain.config.warnings).toEqual([`${configPath}: unknown key db.colour`]);
      const bundled = readFileSync(outfile, "utf8");
      expect(bundled).not.toContain("variant-mcp/bundle");
      expect(bundled).not.toContain('from "variant-api"');
    } finally {
      rmSync(directory, { recursive: true, force: true });
      rmSync(elsewhere, { recursive: true, force: true });
    }
  }, 60_000);

  it("keeps the standalone bin and its --config-only parser", () => {
    const bundle = new URL(import.meta.resolve("variant-mcp/bundle"));
    const pkg = JSON.parse(readFileSync(new URL("../package.json", bundle), "utf8")) as {
      bin: Record<string, string>;
    };
    const source = readFileSync(bundle, "utf8");
    const options = source.slice(source.indexOf("options:"), source.indexOf("strict:"));
    const entry = readFileSync(new URL("./mcp-entry.ts", import.meta.url), "utf8");

    expect(pkg.bin).toEqual({ "variant-mcp": "./dist/mcp.js" });
    expect(options).toContain("config:");
    expect(options).not.toContain("cwd");
    expect(entry).toContain('import("variant-mcp/bundle")');
    expect(entry).not.toContain("variant-mcp/src/");
  });
});

interface Talk {
  names: string[];
  config: { warnings?: string[] };
}

/** esbuild's service dies when a neighbour test is killed. One more start is enough. */
const buildBundle = async (options: BuildOptions, outfile: string): Promise<void> => {
  const build = {
    ...options,
    absWorkingDir: join(import.meta.dir, ".."),
    outfile,
    logLevel: "silent" as const,
  };
  try {
    await esbuild.build(build);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("service is no longer running")) {
      throw error;
    }
    await esbuild.build(build);
  }
};

const talk = async (outfile: string, cwd: string, args: string[]): Promise<Talk> => {
  const input = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "variant_config", arguments: {} } },
  ]
    .map((message) => JSON.stringify(message))
    .join("\n");
  const proc = Bun.spawn(["node", outfile, ...args], {
    cwd,
    env: { ...process.env, VARIANT_WORKTREE: "0" },
    stdin: new Blob([`${input}\n`]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const messages = stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as { id?: number; result?: { tools?: { name: string }[]; content?: { text: string }[] } },
    );
  if (exitCode !== 0) {
    throw new Error(`mcp bundle exited ${exitCode}: ${stderr}`);
  }
  const tools = messages.find((message) => message.id === 2)?.result?.tools ?? [];
  const call = messages.find((message) => message.id === 3);
  return {
    names: tools.map((tool) => tool.name),
    config: JSON.parse(call?.result?.content?.[0]?.text ?? "{}") as { warnings?: string[] },
  };
};
