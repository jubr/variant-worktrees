import { createServer } from "node:net";
import type { ResolvedConfig, VariantInstance } from "./schema.js";

/** A port the operating system reports as free right now, always in the unprivileged range. */
const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => (port >= 1024 ? resolve(port) : freePort().then(resolve, reject)));
    });
  });

/** The key of an instance in the runtime state: its name, or its kind when it has none. */
export const instanceKey = (instance: VariantInstance): string => instance.name ?? instance.kind;

/**
 * The port of one instance: `runtime.instances.<name>.port` of the local runtime state, otherwise a random free port.
 * Nothing is written, so a random port is not stable between calls; `writeRuntime` records one.
 */
export const resolveInstancePort = async (config: ResolvedConfig, instance: VariantInstance): Promise<number> =>
  config.runtime?.instances?.[instanceKey(instance)]?.port ?? (await freePort());

/** The `open` template of an instance with `{{slug}}` and `{{port}}` replaced, or nothing when it has none. */
export const openUrlFor = async (
  config: ResolvedConfig,
  slug: string,
  instance: VariantInstance,
): Promise<string | undefined> => {
  if (instance.open === undefined) {
    return undefined;
  }
  const port = await resolveInstancePort(config, instance);
  return instance.open.replaceAll("{{slug}}", slug).replaceAll("{{port}}", String(port));
};
