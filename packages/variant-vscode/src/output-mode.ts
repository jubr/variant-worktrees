/** An enabled extension, as far as output-mode detection needs it. */
export interface ListedExtension {
  packageJSON?: { description?: unknown };
}

/**
 * `tty` when an enabled extension can show ANSI logs. Both words are matched in the description, ignoring case.
 * Specification: openspec/specs/variant-vscode/variants-tree/spec.md
 */
export const outputModeForExtensions = (extensions: readonly ListedExtension[]): "tty" | "no-tty" => {
  const ansiLog = extensions.some((extension) => {
    const description = extension.packageJSON?.description;
    if (typeof description !== "string") {
      return false;
    }
    const text = description.toLowerCase();
    return text.includes("log") && text.includes("ansi");
  });
  return ansiLog ? "tty" : "no-tty";
};
