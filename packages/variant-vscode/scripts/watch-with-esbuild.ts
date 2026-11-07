import esbuild from "esbuild";
import config, { mcpBundle } from "./esbuild.config";

try {
  const extension = await esbuild.context(config);
  const mcp = await esbuild.context(mcpBundle);
  await Promise.all([extension.watch(), mcp.watch()]);
} catch (e) {
  process.exit(1);
}
