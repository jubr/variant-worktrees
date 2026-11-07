const flag = process.argv.indexOf("--cwd");
if (flag !== -1) {
  const directory = process.argv[flag + 1];
  if (directory === undefined) {
    throw new Error("--cwd requires a directory");
  }
  process.chdir(directory);
  process.argv.splice(flag, 2);
}

await import("../../variant-mcp/src/mcp.ts");
