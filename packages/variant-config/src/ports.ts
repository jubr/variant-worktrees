import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { ResolvedConfig, VariantInstance } from "./schema.js";

/** State file keys that hold the port of an instance, by kind. This is the format existing variant tooling writes. */
const PORT_KEYS: Record<VariantInstance["kind"], string> = {
  vite: "spa_port",
  nestjs: "api_port",
};

/** The port a kind of instance was assigned in `<cacheDir>/<slug>.yaml`, if the file names a usable one. */
const assignedPort = (cacheDir: string, slug: string, kind: VariantInstance["kind"]): number | undefined => {
  try {
    const state: unknown = parseYaml(readFileSync(join(cacheDir, `${slug}.yaml`), "utf8"));
    const value =
      typeof state === "object" && state !== null ? (state as Record<string, unknown>)[PORT_KEYS[kind]] : undefined;
    const port = typeof value === "string" ? Number(value) : value;
    return typeof port === "number" && Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined;
  } catch {
    return undefined;
  }
};

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

/**
 * The port of one instance of a variant: the one assigned in `<cacheDir>/<slug>.yaml` (`spa_port` for Vite, `api_port`
 * for NestJS), otherwise a random free port. Nothing is written, so a random port is not stable between calls.
 */
export const resolveInstancePort = async (
  config: ResolvedConfig,
  slug: string,
  instance: VariantInstance,
): Promise<number> => {
  const cacheDir = config.variant?.cacheDir;
  return (cacheDir ? assignedPort(cacheDir, slug, instance.kind) : undefined) ?? (await freePort());
};

/** The `open` template of an instance with `{{slug}}` and `{{port}}` replaced, or nothing when it has none. */
export const openUrlFor = async (
  config: ResolvedConfig,
  slug: string,
  instance: VariantInstance,
): Promise<string | undefined> => {
  if (instance.open === undefined) {
    return undefined;
  }
  const port = await resolveInstancePort(config, slug, instance);
  return instance.open.replaceAll("{{slug}}", slug).replaceAll("{{port}}", String(port));
};
