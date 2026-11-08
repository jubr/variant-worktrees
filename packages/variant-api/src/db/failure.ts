import type { DbConfig } from "variant-config";
import { logD, logW } from "../log.js";

/** Specification: openspec/specs/variant-api/logging/spec.md */

export interface ContactTarget {
  dialect: "postgres" | "mysql";
  database: string;
  host: string;
  port: number;
}

/** The configured database could not be contacted. The message names the target and nothing secret. */
export class DatabaseContactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseContactError";
  }
}

/** A database command failed after contact. The message has no SQL. */
export class DatabaseCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseCommandError";
  }
}

const CONTACT_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "CONNECT_TIMEOUT",
  "CONNECTION_TIMEOUT",
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "28P01",
  "28000",
  "3D000",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ER_DBACCESS_DENIED_ERROR",
]);

/** MySQL errno values for access denied and an unknown database. Node's `ECONNREFUSED` errno is not in this set. */
const CONTACT_ERRNOS = new Set([1044, 1045, 1049]);

const fallbackPort = (dialect: "postgres" | "mysql"): number => (dialect === "postgres" ? 5432 : 3306);

const numericPort = (port: DbConfig["port"], fallback: number): number => {
  if (typeof port === "number" && Number.isInteger(port) && port > 0) {
    return port;
  }
  if (typeof port === "string" && /^[0-9]+$/.test(port)) {
    return Number(port);
  }
  return fallback;
};

/** Where a PostgreSQL or MySQL command was aimed. Built from the configured target, never from driver text. */
export const contactTarget = (config: DbConfig): ContactTarget | undefined => {
  if (config.dialect !== "postgres" && config.dialect !== "mysql") {
    return undefined;
  }
  const port = fallbackPort(config.dialect);
  if (config.url) {
    try {
      const url = new URL(config.url);
      return {
        dialect: config.dialect,
        database: decodeURIComponent(url.pathname.replace(/^\//, "")),
        host: url.hostname,
        port: url.port === "" ? port : Number(url.port),
      };
    } catch {
      // A URL the platform cannot parse still has the discrete fields, when they were set.
    }
  }
  return {
    dialect: config.dialect,
    database: config.database ?? "",
    host: config.host ?? "127.0.0.1",
    port: numericPort(config.port, port),
  };
};

export const contactWarning = (target: ContactTarget): string =>
  `Cannot contact ${target.dialect} database ${target.database} at ${target.host}:${target.port}`;

const nodesOf = (error: unknown): object[] => {
  const found: object[] = [];
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== "object" || found.includes(value)) {
      return;
    }
    found.push(value);
    const record = value as { cause?: unknown; errors?: unknown };
    visit(record.cause);
    if (Array.isArray(record.errors)) {
      for (const item of record.errors) {
        visit(item);
      }
    }
  };
  visit(error);
  return found;
};

const isContact = (error: unknown): boolean =>
  nodesOf(error).some((node) => {
    const code = (node as { code?: unknown }).code;
    if (typeof code === "string" && CONTACT_CODES.has(code)) {
      return true;
    }
    const errno = (node as { errno?: unknown }).errno;
    return typeof errno === "number" && CONTACT_ERRNOS.has(errno);
  });

const statementOf = (error: unknown): string | undefined => {
  for (const node of nodesOf(error)) {
    const query = (node as { query?: unknown }).query;
    if (typeof query === "string" && query !== "") {
      return query;
    }
  }
  for (const node of nodesOf(error)) {
    const message = (node as { message?: unknown }).message;
    if (typeof message !== "string" || !message.startsWith("Failed query:")) {
      continue;
    }
    const line = message.slice("Failed query:".length).trim().split("\n")[0]?.trim();
    if (line !== undefined && line !== "" && !line.startsWith("params:")) {
      return line;
    }
  }
  return undefined;
};

const visibleMessage = (error: unknown, statement: string | undefined): string => {
  const messages = nodesOf(error)
    .map((node) => (node as { message?: unknown }).message)
    .filter((message): message is string => typeof message === "string")
    .reverse();
  const safe = messages.find(
    (message) => !message.includes("Failed query") && (statement === undefined || !message.includes(statement)),
  );
  return safe ?? "The database command failed";
};

/** One command's database calls share a guard so a contact failure warns once. */
export class QueryGuard {
  private warned = false;
  private quiet = false;

  constructor(private readonly target: ContactTarget | undefined) {}

  /** Later attempts of one outage stay silent. The first attempt of the next outage uses a new guard. */
  silence(): void {
    this.quiet = true;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const statement = statementOf(error);
      if (statement !== undefined && !this.quiet) {
        logD(statement);
      }
      if (this.target !== undefined && isContact(error)) {
        const message = contactWarning(this.target);
        if (!this.warned && !this.quiet) {
          this.warned = true;
          logW(message);
        }
        throw new DatabaseContactError(message);
      }
      throw new DatabaseCommandError(visibleMessage(error, statement));
    }
  }
}
