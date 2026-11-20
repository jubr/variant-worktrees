/**
 * Specification: openspec/specs/variant-cli/global-options/spec.md
 *
 * Takes the global slug option (`-s <slug>`, `--slug <slug>`, `--slug=<slug>`) out of the arguments, wherever it
 * stands, so every command sees the same arguments and commands that take no slug ignore it.
 * The last one given wins. A slug without a value fails.
 */
export const takeSlug = (argv: string[]): { args: string[]; slug?: string } => {
  const args: string[] = [];
  let slug: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg.startsWith("--slug=")) {
      slug = arg.slice("--slug=".length);
      if (slug === "") {
        throw new Error("--slug requires a slug.");
      }
      continue;
    }
    if (arg !== "-s" && arg !== "--slug") {
      args.push(arg);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value === "" || value.startsWith("-")) {
      throw new Error(`${arg} requires a slug.`);
    }
    slug = value;
    index += 1;
  }
  return slug === undefined ? { args } : { args, slug };
};
