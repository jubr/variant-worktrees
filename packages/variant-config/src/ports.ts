import { createServer } from "node:net";
import type { PortRange, ResolvedConfig } from "./schema.js";
import { renderTemplate } from "./template.js";

/** Whether a loopback listen on `port` succeeds right now. */
const listensOnLoopback = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });

export interface PickFreePortOptions {
  /** Ports that are taken although they are free, such as those assigned to other watches of the same run. */
  exclude?: readonly number[];
  /** Whether a port is free; a loopback listen by default. */
  isFree?: (port: number) => Promise<boolean>;
  /** Offset into the range of the first port to try; random by default. */
  start?: number;
}

/**
 * A free port of `range`: the ports are tried in order from a random offset, wrapping once from the top to the bottom,
 * and the first that is not excluded and that a loopback listen reports free is returned. Throws an error that names the
 * range when none is.
 */
export const pickFreePort = async (range: PortRange, options: PickFreePortOptions = {}): Promise<number> => {
  const { exclude = [], isFree = listensOnLoopback } = options;
  const size = range.high - range.low + 1;
  const start = options.start ?? Math.floor(Math.random() * size);
  for (let step = 0; step < size; step++) {
    const port = range.low + ((start + step) % size);
    if (!exclude.includes(port) && (await isFree(port))) {
      return port;
    }
  }
  throw new Error(
    `No free port in the range ${range.low}-${range.high}. Widen it with variant.ports.range or stop a variant that holds ports.`,
  );
};

/**
 * The port of the watch with the given key: `VARIANT_<KEY>_PORT` or `runtime.watches.<key>.port` of the local
 * runtime state (`loadConfig` has merged the two), otherwise a free port of `variant.ports.range`. Nothing is written,
 * so a picked port is not stable between calls; `writeRuntime` records one. A port that is assigned explicitly is
 * kept wherever it lies: the range limits only picked ports.
 */
export const resolveWatchPort = async (config: ResolvedConfig, key: string): Promise<number> =>
  config.runtime?.watches?.[key]?.port ?? (await pickFreePort(config.variant.ports));

/** The `url` template of the watch with the given key, `${slug}`, `${abbr}` and `${port}` replaced, or nothing without one. */
export const openUrlFor = async (config: ResolvedConfig, slug: string, key: string): Promise<string | undefined> => {
  const template = config.variant.watches[key]?.url;
  if (template === undefined) {
    return undefined;
  }
  const port = await resolveWatchPort(config, key);
  return renderTemplate(template, {
    slug,
    abbr: config.variant.abbr,
    port,
    env: config.environment,
    setting: `variant.watches.${key}.url`,
  });
};
