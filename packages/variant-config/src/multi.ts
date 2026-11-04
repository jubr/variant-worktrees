const TENANT = /^[A-Za-z0-9_-]+$/;

/** Splits a tenant list on commas and whitespace, strips one pair of quotes, and drops empties and repeats. */
export const parseMultiList = (text: string): string[] => {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    const item = raw.replace(/^(['"])(.*)\1$/, "$2");
    if (item === "") {
      continue;
    }
    if (!TENANT.test(item)) {
      throw new Error(`invalid tenant ${item}`);
    }
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    values.push(item);
  }
  return values;
};

/** Tenant schema: `schemaPrefix` with `${slug}` filled in, then the tenant. A hyphen in the slug stays. */
export const multiSchemaName = (schemaPrefix: string, slug: string, tenant: string): string =>
  `${schemaPrefix.replaceAll("${slug}", slug)}${tenant}`;

/** SQL LIKE pattern of every schema under the expanded prefix. `\`, `%` and `_` match literally. */
export const multiLikePattern = (prefix: string): string =>
  `${prefix.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;

/** Schema names that start with the expanded prefix, sorted. The match is literal. */
export const groupMultiSchemas = (names: readonly string[], prefix: string): string[] =>
  names.filter((name) => name.startsWith(prefix)).sort();

const MULTI_PART = /^[A-Za-z0-9_-]+$/;

/**
 * The literal text of `schemaPrefix` around its `${slug}`. Nothing when the template has no slug token, a second one,
 * another placeholder, or no separator after the slug: those cannot be split from a schema name.
 */
const prefixAroundSlug = (template: string): { head: string; tail: string } | undefined => {
  const token = "${slug}";
  const start = template.indexOf(token);
  if (start < 0 || template.includes(token, start + token.length)) {
    return undefined;
  }
  const head = template.slice(0, start);
  const tail = template.slice(start + token.length);
  if (tail === "" || head.includes("${") || tail.includes("${")) {
    return undefined;
  }
  return { head, tail };
};

/** The literal before `${slug}` in `schemaPrefix`, when it can be used as a database prefix. */
export const multiSchemaHead = (template: string): string | undefined => {
  const parts = prefixAroundSlug(template);
  if (parts === undefined || parts.head === "") {
    return undefined;
  }
  return parts.head;
};

/**
 * Schemas no known variant claimed, grouped by a best-effort reading of `schemaPrefix`.
 * The slug is the text before the last copy of the separator that follows `${slug}`, so a hyphen in the slug stays
 * and the tenant is the final segment.
 */
export const groupOrphanSchemas = (
  names: readonly string[],
  schemaPrefix: string,
): Array<{ slug: string; schemas: string[] }> => {
  const parts = prefixAroundSlug(schemaPrefix);
  if (parts === undefined) {
    return [];
  }
  const groups = new Map<string, string[]>();
  for (const name of names) {
    if (!name.startsWith(parts.head)) {
      continue;
    }
    const rest = name.slice(parts.head.length);
    const split = rest.lastIndexOf(parts.tail);
    if (split <= 0) {
      continue;
    }
    const slug = rest.slice(0, split);
    const tenant = rest.slice(split + parts.tail.length);
    if (!MULTI_PART.test(slug) || !MULTI_PART.test(tenant)) {
      continue;
    }
    const found = groups.get(slug);
    if (found) {
      found.push(name);
    } else {
      groups.set(slug, [name]);
    }
  }
  return [...groups.entries()].map(([slug, schemas]) => ({ slug, schemas: [...schemas].sort() }));
};
