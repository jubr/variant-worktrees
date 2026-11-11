import esbuild from "esbuild";
import config, { mcpBundle, watchRelayBundle } from "./esbuild.config";

try {
  const extension = await esbuild.context(config);
  const mcp = await esbuild.context(mcpBundle);
  const relay = await esbuild.context(watchRelayBundle);
  await Promise.all([extension.watch(), mcp.watch(), relay.watch()]);
} catch (e) {
  process.exit(1);
}
