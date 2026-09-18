import type { DbConfig } from "variant-config";
import type { DatabaseAdapter } from "../types.js";
import { MysqlAdapter } from "./mysql.js";
import { PostgresAdapter } from "./postgres.js";
import { SqliteAdapter } from "./sqlite.js";

export const createDatabaseAdapter = (config: DbConfig, stateDir: string): DatabaseAdapter => {
  switch (config.dialect) {
    case "postgres":
      return new PostgresAdapter(config);
    case "mysql":
      return new MysqlAdapter(config);
    case "sqlite":
      return new SqliteAdapter(config, stateDir);
    default:
      throw new Error(`Unsupported database dialect: ${String(config.dialect)}`);
  }
};
