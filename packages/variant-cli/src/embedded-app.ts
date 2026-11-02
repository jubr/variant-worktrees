/**
 * The variants app as the compiled executable carries it: file name in the app to the path of the embedded file.
 *
 * AIDEV-NOTE: this source module is a placeholder. `scripts/package-cli.ts` swaps it for a module of
 * `with { type: "file" }` imports while compiling, because embedded files get hashed names and need a map back.
 * Everywhere else (source, the npm package) the app is a directory and this stays empty.
 */
export const embeddedApp: Readonly<Record<string, string>> | undefined = undefined as
  | Readonly<Record<string, string>>
  | undefined;
