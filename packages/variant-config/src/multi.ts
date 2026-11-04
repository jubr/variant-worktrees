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
