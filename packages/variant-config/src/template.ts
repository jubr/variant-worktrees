/** Values of the variant placeholders. A missing value renders as an empty string. */
export interface TemplateContext {
  slug?: string;
  /** The project abbreviation, `variant.abbr`. */
  abbr?: string;
  /** The database target of the variant. */
  schema?: string;
  storage?: string;
  worktree?: string;
  url?: string;
  /** The port of the watch the value belongs to. */
  port?: number | string;
  /** The ports of all watches, by key, for `${<key>.port}`. */
  ports?: Readonly<Record<string, number | string>>;
  /** The environment for `${NAME}`; the process environment by default. A function is called at most once, only when a name is referenced. */
  env?: NodeJS.ProcessEnv | (() => NodeJS.ProcessEnv);
  /** The setting the value belongs to (`db.password`), named in failures. */
  setting?: string;
  /** `false` for a setting that belongs to no variant (`db`): a variant placeholder then fails. */
  variant?: boolean;
}

const ESCAPE = "\u0000";
const VARIANT_PLACEHOLDER =
  /\$\{(slug|abbr|schema|storage|worktree|url|port|port\.[A-Za-z][A-Za-z0-9_-]*|[A-Za-z][A-Za-z0-9_-]*\.port)\}/g;
const ENV_TEMPLATE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^{}]*))?\}/g;

const where = (context: TemplateContext): string => (context.setting ? ` in ${context.setting}` : "");

/**
 * Expands a templated value in two passes: first the variant placeholders `${slug}`, `${abbr}`, `${schema}`,
 * `${storage}`, `${worktree}`, `${url}`, `${port}` and `${<key>.port}`, then `${NAME}` and `${NAME:-default}` from the
 * environment. The order lets a default hold a placeholder: `${SECRET:-local-${slug}}`. `$${` stands for a literal
 * `${`. An unset `${NAME}` without a default throws, because a silently empty secret or port is worse than a failed
 * command; so does a variant placeholder when `context.variant` is `false`.
 */
export const renderTemplate = (value: string, context: TemplateContext = {}): string => {
  const kept = value.replaceAll("$${", ESCAPE);
  const variant = kept.replace(VARIANT_PLACEHOLDER, (_match, name: string) => {
    if (context.variant === false) {
      throw new Error(`Template \${${name}}${where(context)} needs a variant, which this setting does not have`);
    }
    if (name.endsWith(".port")) {
      const key = name.slice(0, -".port".length);
      const port = context.ports?.[key];
      if (port === undefined) {
        throw new Error(`Template \${${name}}${where(context)} names watch ${key}, which has no port`);
      }
      return String(port);
    }
    if (name.startsWith("port.")) {
      throw new Error(
        `Template \${${name}}${where(context)} is the former form: write \${${name.slice("port.".length)}.port}`,
      );
    }
    return String(context[name as "slug" | "abbr" | "schema" | "storage" | "worktree" | "url" | "port"] ?? "");
  });
  let environment: NodeJS.ProcessEnv | undefined;
  const read = (): NodeJS.ProcessEnv => {
    const source = context.env ?? process.env;
    environment ??= typeof source === "function" ? source() : source;
    return environment;
  };
  return variant
    .replace(ENV_TEMPLATE, (_match, name: string, fallback: string | undefined) => {
      const set = read()[name];
      if (set !== undefined && set !== "") {
        return set;
      }
      if (fallback !== undefined) {
        return fallback;
      }
      if (set === undefined) {
        throw new Error(
          `Template \${${name}}${where(context)} needs the environment variable ${name}, which is not set`,
        );
      }
      return set;
    })
    .replaceAll(ESCAPE, "${");
};
