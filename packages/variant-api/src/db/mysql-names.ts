/**
 * Specification: openspec/specs/variant-api/core/spec.md (One MySQL database per variant)
 *
 * MySQL has no schemas, so a variant is a database. `db.database` may hold `${schema}`, the schema name of the variant
 * (`v_feature_42`), as in `project_x__${schema}`: that is the database of the variant. Without `${schema}` the database
 * of a variant is its schema name alone, and `db.database` only names the database the connection starts in.
 */

const PLACEHOLDER = "${schema}";

/** Whether `template` (`db.database`) names a database per variant. */
export const hasSchemaPlaceholder = (template: string | undefined): template is string =>
  template?.includes(PLACEHOLDER) === true;

/** The database of the variant whose schema name is `schema`. */
export const mysqlDatabase = (template: string | undefined, schema: string): string =>
  hasSchemaPlaceholder(template) ? template.replaceAll(PLACEHOLDER, () => schema) : schema;

/** The text before and after the one `${schema}` of `template`. */
const around = (template: string): { head: string; tail: string } => {
  const parts = template.split(PLACEHOLDER);
  if (parts.length !== 2) {
    throw new Error(`db.database can hold ${PLACEHOLDER} only once, got ${template}`);
  }
  return { head: parts[0] as string, tail: parts[1] as string };
};

const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (character) => `\\${character}`);

/** The `LIKE` pattern of the databases of all variants: `v\_%` without `${schema}`. */
export const variantDatabasePattern = (template: string | undefined): string => {
  if (!hasSchemaPlaceholder(template)) {
    return "v\\_%";
  }
  const { head, tail } = around(template);
  return `${escapeLike(head)}v\\_%${escapeLike(tail)}`;
};

/** The schema name of a database found by `variantDatabasePattern`; `undefined` for a database of another shape. */
export const schemaOfDatabase = (template: string | undefined, database: string): string | undefined => {
  if (!hasSchemaPlaceholder(template)) {
    return database;
  }
  const { head, tail } = around(template);
  if (!database.startsWith(head) || !database.endsWith(tail) || database.length < head.length + tail.length) {
    return undefined;
  }
  const schema = database.slice(head.length, database.length - tail.length);
  return schema.startsWith("v_") ? schema : undefined;
};
