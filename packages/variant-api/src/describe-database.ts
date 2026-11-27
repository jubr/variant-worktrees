import { type DbConfig, DEFAULT_SQLITE_DATABASE } from "variant-config";
import { hasSchemaPlaceholder, mysqlDatabase } from "./db/mysql-names.js";

/**
 * Specification: openspec/specs/variant-api/core/spec.md (Variant records name their database)
 *
 * Where the data of a variant is, without a secret. SQLite: `db.database` with `${slug}` replaced, relative stays
 * relative. PostgreSQL and MySQL: the connection URL, with `***` for the password; for MySQL with `${schema}` in
 * `db.database` it names the database of the variant, `target` being its schema name.
 */

const MASK = "***";
const SECRET_PARAMETER = /pass(word)?|pwd|secret|token/i;

/** `url` with the password and any secret query parameter replaced; the rest of the text is unchanged. */
const redactUrl = (url: string): string => {
  if (!URL.canParse(url)) {
    return url.replace(/(\/\/[^:/@?#]*:)[^/?#]*@/, `$1${MASK}@`);
  }
  const parsed = new URL(url);
  const hadPassword = parsed.password !== "";
  const authority = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)@/i.exec(url)?.[1];
  let text = url;
  if (hadPassword && authority !== undefined) {
    const user = authority.includes(":") ? authority.slice(0, authority.indexOf(":")) : authority;
    text = url.replace(`//${authority}@`, `//${user}:${MASK}@`);
  }
  return text.replace(/([?&])([^=&#]*)=([^&#]*)/g, (match, lead: string, name: string) =>
    SECRET_PARAMETER.test(name) ? `${lead}${name}=${MASK}` : match,
  );
};

export const describeDatabase = (db: DbConfig, slug: string, target?: string): string => {
  if (db.type === "sqlite") {
    return (db.database ?? DEFAULT_SQLITE_DATABASE).replaceAll("${slug}", slug);
  }
  if (db.url) {
    return redactUrl(db.url);
  }
  const scheme = db.type === "mysql" ? "mysql" : "postgres";
  const user = db.user ? encodeURIComponent(db.user) : "";
  const login = user === "" ? "" : `${user}${db.password ? `:${MASK}` : ""}@`;
  const port = db.port === undefined ? "" : `:${db.port}`;
  // a MySQL `db.database` with `${schema}` is the database of each variant: `target` is the schema name of this one
  const database =
    db.type === "mysql" && hasSchemaPlaceholder(db.database) && target !== undefined
      ? mysqlDatabase(db.database, target)
      : db.database;
  const name = database ? `/${encodeURIComponent(database)}` : "";
  return `${scheme}://${login}${db.host ?? "localhost"}${port}${name}`;
};
