/** Values of the variant placeholders. A missing value renders as an empty string. */
export interface TemplateContext {
  slug?: string;
  /** The database target of the variant. */
  schema?: string;
  storage?: string;
  worktree?: string;
  url?: string;
  /** The port of the instance the value belongs to. */
  port?: number | string;
  /** The ports of all instances, by key, for `{{port.<key>}}`. */
  ports?: Readonly<Record<string, number | string>>;
  /** The environment for `{{NAME}}`; the process environment by default. */
  env?: NodeJS.ProcessEnv;
}

const VARIANT_PLACEHOLDER = /\{\{(slug|schema|storage|worktree|url|port(?:\.[A-Za-z][A-Za-z0-9_-]*)?)\}\}/g;
const ENV_TEMPLATE = /\{\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^{}]*))?\}\}/g;

/**
 * Expands a templated value in two passes: first the variant placeholders `{{slug}}`, `{{schema}}`, `{{storage}}`,
 * `{{worktree}}`, `{{url}}`, `{{port}}` and `{{port.<key>}}`, then `{{NAME}}` and `{{NAME:-default}}` from the
 * environment. The order lets a default hold a placeholder: `{{SECRET:-local-{{slug}}}}`. An unset `{{NAME}}` without
 * a default throws, because a silently empty secret or port is worse than a failed command.
 */
export const renderTemplate = (value: string, context: TemplateContext = {}): string => {
  const env = context.env ?? process.env;
  const variant = value.replace(VARIANT_PLACEHOLDER, (_match, name: string) => {
    if (name.startsWith("port.")) {
      const key = name.slice("port.".length);
      const port = context.ports?.[key];
      if (port === undefined) {
        throw new Error(`Template {{${name}}} names instance ${key}, which has no port`);
      }
      return String(port);
    }
    return String(context[name as "slug" | "schema" | "storage" | "worktree" | "url" | "port"] ?? "");
  });
  return variant.replace(ENV_TEMPLATE, (_match, name: string, fallback: string | undefined) => {
    const set = env[name];
    if (set !== undefined && set !== "") {
      return set;
    }
    if (fallback !== undefined) {
      return fallback;
    }
    if (set === undefined) {
      throw new Error(`Template {{${name}}} needs the environment variable ${name}, which is not set`);
    }
    return set;
  });
};
