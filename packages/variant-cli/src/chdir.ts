/**
 * Specification: openspec/specs/variant-cli/working-directory/spec.md
 *
 * Takes `-C <path>` out of the arguments, wherever it stands, and changes to that directory
 * before configuration is read.
 */
export const takeDirectory = (argv: string[]): { args: string[] } => {
  const args: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    const attached = arg.startsWith("-C") && arg.length > 2 ? arg.slice(2) : undefined;
    if (arg !== "-C" && attached === undefined) {
      args.push(arg);
      continue;
    }
    const path = attached ?? argv[index + 1];
    if (path === undefined) {
      throw new Error("-C requires a directory.");
    }
    if (attached === undefined) {
      index += 1;
    }
    try {
      process.chdir(path);
    } catch {
      throw new Error(`-C cannot change directory to ${path}.`);
    }
  }
  return { args };
};
