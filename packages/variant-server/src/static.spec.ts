import { describe, expect, it } from "bun:test";
import { join } from "node:path";
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

  describe("from a map of file names to paths", () => {
    // AIDEV-NOTE: a compiled executable embeds the app under hashed names, so it hands the server a map, not a directory
    const files = { "embedded-1.bin": "<!doctype html><title>Embedded</title>", "embedded-2.bin": "console.log(2)" };
    const app = (directory: string) => ({
      "index.html": join(directory, "embedded-1.bin"),
      "chunk.js": join(directory, "embedded-2.bin"),
    });

    it("serves the listed files under their names, with their content type", () =>
      withServer(
        async ({ call }) => {
          const script = await call("GET", "/chunk.js");

          expect(script.status).toBe(200);
          expect(script.headers["content-type"]).toContain("text/javascript");
          expect(script.body).toBe("console.log(2)");
        },
        { files, app },
      ));

    it("serves index.html for / and for a client route", () =>
      withServer(
        async ({ call }) => {
          for (const path of ["/", "/variants/demo"]) {
            const response = await call("GET", path);

            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toContain("text/html");
            expect(response.body).toContain("<title>Embedded</title>");
          }
        },
        { files, app },
      ));

    it("does not serve a file that is not listed", () =>
      withServer(
        async ({ call }) => {
          expect((await call("GET", "/embedded-2.bin")).body).toContain("<title>Embedded</title>");
          expect((await call("GET", "/%2e%2e/embedded-2.bin")).body).toContain("<title>Embedded</title>");
        },
        { files, app },
      ));
  });

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
