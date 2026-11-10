const flag = process.argv.indexOf("--cwd");
if (flag !== -1) {
  const directory = process.argv[flag + 1];
  if (directory === undefined) {
    throw new Error("--cwd requires a directory");
  }
  process.chdir(directory);
  process.argv.splice(flag, 2);
}

// AIDEV-NOTE: `variant-mcp/bundle` is the server source. The extension bundle inlines it, including variant-api.
await import("variant-mcp/bundle");
