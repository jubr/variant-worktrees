import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The built variants app: the `dist` directory of the `variant-ui` package. */
export const defaultStaticDir = (): string =>
  join(dirname(fileURLToPath(import.meta.resolve("variant-ui/package.json"))), "dist");
