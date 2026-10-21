import { createServer } from "node:net";
import type { ResolvedConfig } from "./schema.js";

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

/** A free port that is not in `reserved`; `candidate` produces the free ports to try. */
export const pickFreePort = async (
  reserved: readonly number[],
  candidate: () => Promise<number> = freePort,
): Promise<number> => {
  for (;;) {
    const port = await candidate();
    if (!reserved.includes(port)) {
      return port;
    }
  }
};

/**
 * The port of the instance with the given key: `VARIANT_<KEY>_PORT` or `runtime.instances.<key>.port` of the local
 * runtime state (`loadConfig` has merged the two), otherwise a random free port that is not in `variant.reservedPorts`.
 * Nothing is written, so a random port is not stable between calls; `writeRuntime` records one. A reserved port that is
 * assigned explicitly is kept: reservation limits only picked ports.
 */
export const resolveInstancePort = async (config: ResolvedConfig, key: string): Promise<number> =>
  config.runtime?.instances?.[key]?.port ?? (await pickFreePort(config.variant.reservedPorts));

/** The `open` template of the instance with the given key, `{{slug}}` and `{{port}}` replaced, or nothing without one. */
export const openUrlFor = async (config: ResolvedConfig, slug: string, key: string): Promise<string | undefined> => {
  const template = config.variant.instances[key]?.open;
  if (template === undefined) {
    return undefined;
  }
  const port = await resolveInstancePort(config, key);
  return template.replaceAll("{{slug}}", slug).replaceAll("{{port}}", String(port));
};
