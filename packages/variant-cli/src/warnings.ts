const printed = new Set<string>();

/**
 * Prints each configuration warning as `warning: <message>` on standard error, once per process, so a result on
 * standard output stays clean and a command that loads the configuration twice does not repeat itself.
 */
export const printWarnings = (warnings: readonly string[]): void => {
  for (const warning of warnings) {
    if (!printed.has(warning)) {
      printed.add(warning);
      console.error(`warning: ${warning}`);
    }
  }
};
