import { createRequire } from "node:module";
import { runWatchRelay } from "variant-api";
import { runMcpServer } from "variant-mcp/bundle";

const flag = process.argv.indexOf("--cwd");
if (flag !== -1) {
  const directory = process.argv[flag + 1];
  if (directory === undefined) {
    throw new Error("--cwd requires a directory");
  }
  process.chdir(directory);
  process.argv.splice(flag, 2);
}

if (process.argv.includes("--internal-watch-relay")) {
  await runWatchRelay();
  process.exit(process.exitCode ?? 0);
}

// AIDEV-NOTE: `variant-mcp/bundle` is the server source. The extension bundle inlines it, including variant-api.
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };
await runMcpServer({ args: process.argv.slice(2), version });
