import { describe, expect, it } from "bun:test";
import { mysqlDatabase, schemaOfDatabase, variantDatabasePattern } from "./mysql-names.js";

const TEMPLATE = "project_x__${schema}";

describe("MySQL database of a variant", () => {
  it("is the template with the schema name filled in", () => {
    expect(mysqlDatabase(TEMPLATE, "v_feature_42")).toBe("project_x__v_feature_42");
  });

  it("is the schema name alone without ${schema}, and for no database at all", () => {
    expect(mysqlDatabase("project_x", "v_feature_42")).toBe("v_feature_42");
    expect(mysqlDatabase(undefined, "v_feature_42")).toBe("v_feature_42");
  });

  it("keeps a $ in the schema name as it is", () => {
    expect(mysqlDatabase(TEMPLATE, "v_a$&b")).toBe("project_x__v_a$&b");
  });

  it("finds the databases of all variants with a LIKE pattern that escapes _ and %", () => {
    expect(variantDatabasePattern(TEMPLATE)).toBe("project\\_x\\_\\_v\\_%");
    expect(variantDatabasePattern("100%__${schema}_db")).toBe("100\\%\\_\\_v\\_%\\_db");
    expect(variantDatabasePattern("project_x")).toBe("v\\_%");
  });

  it("reads the schema name back from a database", () => {
    expect(schemaOfDatabase(TEMPLATE, "project_x__v_feature_42")).toBe("v_feature_42");
    expect(schemaOfDatabase("${schema}_app", "v_feature_42_app")).toBe("v_feature_42");
    expect(schemaOfDatabase("project_x", "v_feature_42")).toBe("v_feature_42");
  });

  it("skips a database that does not have the shape of a variant", () => {
    expect(schemaOfDatabase(TEMPLATE, "other__v_feature_42")).toBeUndefined();
    expect(schemaOfDatabase(TEMPLATE, "project_x__feature_42")).toBeUndefined();
    expect(schemaOfDatabase(TEMPLATE, "project_x__")).toBeUndefined();
  });

  it("refuses a second ${schema}", () => {
    expect(() => variantDatabasePattern("${schema}__${schema}")).toThrow(/only once/);
  });
});
