/**
 * The server as a script, `bun run src/mcp.ts [--config <path>]`, for the tests and `task` development runs. It is not
 * a `bin` of the package: users start the server with `variant mcp`.
 */
import { createRequire } from "node:module";
import { runWatchRelay } from "variant-api";
import { runMcpServer } from "./server.js";

if (process.argv.includes("--internal-watch-relay")) {
  await runWatchRelay();
  process.exit(process.exitCode ?? 0);
}

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

await runMcpServer({ args: process.argv.slice(2), version });
