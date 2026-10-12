import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { variantsJsonSchema, variantsLocalJsonSchema } from "../src/schema.js";

const committed = (name: string): unknown => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));
const generated = (schema: unknown): unknown => JSON.parse(JSON.stringify(schema));

describe("JSON schema files", () => {
  it("variants.yaml.schema.json is the JSON schema the code generates", () => {
    expect(committed("variants.yaml.schema.json")).toEqual(generated(variantsJsonSchema));
  });

  it("variants.local.yaml.schema.json is the JSON schema the code generates", () => {
    expect(committed("variants.local.yaml.schema.json")).toEqual(generated(variantsLocalJsonSchema));
  });
});
