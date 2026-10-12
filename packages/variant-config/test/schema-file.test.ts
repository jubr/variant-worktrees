import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { variantsJsonSchema } from "../src/schema.js";

describe("variants.yaml.schema.json", () => {
  it("is the JSON schema the code generates", () => {
    const committed = JSON.parse(readFileSync(new URL("../variants.yaml.schema.json", import.meta.url), "utf8"));

    expect(committed).toEqual(JSON.parse(JSON.stringify(variantsJsonSchema)));
  });
});
