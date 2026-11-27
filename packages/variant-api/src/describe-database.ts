import { type DbConfig, DEFAULT_SQLITE_DATABASE } from "variant-config";

/**
 * Specification: openspec/specs/variant-api/core/spec.md (Variant records name their database)
 *
 * Where the data of a variant is, without a secret. SQLite: `db.database` with `${slug}` replaced, relative stays
 * relative. PostgreSQL and MySQL: the connection URL, with `***` for the password.
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

export const describeDatabase = (db: DbConfig, slug: string): string => {
  if (db.dialect === "sqlite") {
    return (db.database ?? DEFAULT_SQLITE_DATABASE).replaceAll("${slug}", slug);
  }
  if (db.url) {
    return redactUrl(db.url);
  }
  const scheme = db.dialect === "mysql" ? "mysql" : "postgres";
  const user = db.user ? encodeURIComponent(db.user) : "";
  const login = user === "" ? "" : `${user}${db.password ? `:${MASK}` : ""}@`;
  const port = db.port === undefined ? "" : `:${db.port}`;
  const name = db.database ? `/${encodeURIComponent(db.database)}` : "";
  return `${scheme}://${login}${db.host ?? "localhost"}${port}${name}`;
};
