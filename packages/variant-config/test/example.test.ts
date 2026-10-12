import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { VariantsConfigSchema, variantsJsonSchema } from "../src/schema.js";

type JsonSchema = {
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  additionalProperties?: JsonSchema | boolean;
};

const exampleText = readFileSync(new URL("../variants.example.yaml", import.meta.url), "utf8");
const example: unknown = parseYaml(exampleText);

/** Paths of schema options the example does not set. Arrays and records are checked through their first entry. */
const missingOptions = (schema: JsonSchema, value: unknown, path: string): string[] => {
  const missing: string[] = [];
  if (schema.properties) {
    const record = (value ?? {}) as Record<string, unknown>;
    for (const [key, child] of Object.entries(schema.properties)) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in record)) {
        missing.push(childPath);
      } else {
        missing.push(...missingOptions(child, record[key], childPath));
      }
    }
  }
  if (schema.items) {
    const first = Array.isArray(value) ? value[0] : undefined;
    if (first === undefined) {
      missing.push(`${path}[0]`);
    } else {
      missing.push(...missingOptions(schema.items, first, `${path}[0]`));
    }
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    const first = Object.entries((value ?? {}) as Record<string, unknown>)[0];
    if (first === undefined) {
      missing.push(`${path}.<name>`);
    } else {
      missing.push(...missingOptions(schema.additionalProperties, first[1], `${path}.${first[0]}`));
    }
  }
  return missing;
};

describe("variants.example.yaml", () => {
  it("validates against the schema", () => {
    const result = VariantsConfigSchema.safeParse(example);

    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it("specifies every option of the schema", () => {
    expect(missingOptions(variantsJsonSchema as JsonSchema, example, "")).toEqual([]);
  });

  it("lists alternatives in end-of-line comments", () => {
    expect(exampleText).toMatch(/dialect: postgres +# .*sqlite/);
    expect(exampleText).toMatch(/kind: vite +# .*nestjs/);
    expect(exampleText).toMatch(/trigger: titleEvent +# .*hook/);
    expect(exampleText).toMatch(/hookScope: workspace +# .*user/);
  });

  it("is detected as incomplete when an option is missing", () => {
    const { chatRenamer: _omitted, ...withoutSection } = example as Record<string, unknown>;

    expect(missingOptions(variantsJsonSchema as JsonSchema, withoutSection, "")).toContain("chatRenamer");
  });
});
