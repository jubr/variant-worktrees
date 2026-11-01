import { describe, expect, it } from "bun:test";
import * as api from "../src/index.js";

describe("public exports", () => {
  it("exports redacted for renderers outside the library", () => {
    expect(api.redacted({ db: { password: "secret", user: "me" } })).toEqual({ db: { password: "***", user: "me" } });
  });
});
