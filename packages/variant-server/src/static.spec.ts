import { describe, expect, it } from "bun:test";
import { withServer } from "./test-support.js";

describe("static app", () => {
  it("serves index.html for /", () =>
    withServer(async ({ call }) => {
      const response = await call("GET", "/");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toContain("<title>Variants</title>");
    }));

  it("serves index.html for a client route that is not a file", () =>
    withServer(async ({ call }) => {
      const response = await call("GET", "/variants/demo");

      expect(response.status).toBe(200);
      expect(response.body).toContain("<title>Variants</title>");
    }));

  it("serves the files of the app with their content type", () =>
    withServer(
      async ({ call }) => {
        const script = await call("GET", "/chunk.js");
        const style = await call("GET", "/chunk.css");

        expect(script.headers["content-type"]).toContain("text/javascript");
        expect(script.body).toBe("console.log(1)");
        expect(style.headers["content-type"]).toContain("text/css");
      },
      { files: { "app/chunk.js": "console.log(1)", "app/chunk.css": "body{}" } },
    ));

  it("carries a content security policy that denies scripts and styles from other origins", () =>
    withServer(async ({ call }) => {
      for (const path of ["/", "/variants/demo"]) {
        const policy = String((await call("GET", path)).headers["content-security-policy"]);

        expect(policy).toContain("script-src 'self'");
        expect(policy).toContain("style-src 'self'");
        expect(policy).toContain("default-src 'none'");
        expect(policy).not.toContain("unsafe-inline");
        expect(policy).not.toContain("*");
      }
    }));

  it("does not serve files outside the app directory", () =>
    withServer(
      async ({ call }) => {
        const response = await call("GET", "/%2e%2e/secret.txt");

        expect(response.body).not.toContain("secret");
      },
      { files: { "secret.txt": "secret" } },
    ));

  it("needs the token", () =>
    withServer(async ({ call }) => {
      expect((await call("GET", "/", { auth: false })).status).toBe(401);
    }));

  it("serves no unknown path below /api as the app", () =>
    withServer(async ({ call }) => {
      expect((await call("GET", "/api/nothing")).status).toBe(404);
    }));
});
