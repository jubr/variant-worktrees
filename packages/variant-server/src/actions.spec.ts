import { describe, expect, it } from "bun:test";
import { record, withServer } from "./test-support.js";

const JSON_HEADERS = { "content-type": "application/json" };
const records = [record("main"), record("demo")];

describe("action routes", () => {
  it("starts a detached watch and answers 200", () =>
    withServer(
      async ({ call, client }) => {
        const response = await call("POST", "/api/variants/demo/watch", { headers: JSON_HEADERS, body: "{}" });

        expect(response.status).toBe(200);
        expect(client.calls).toEqual(["watch demo"]);
        expect(client.watchOptions[0]).toMatchObject({ detach: true });
        expect(JSON.parse(response.body)).toEqual({ slug: "demo" });
      },
      { records },
    ));

  it("accepts an action without a body", () =>
    withServer(
      async ({ call, client }) => {
        expect((await call("POST", "/api/variants/demo/down", { headers: JSON_HEADERS })).status).toBe(200);
        expect(client.calls).toEqual(["down demo"]);
      },
      { records },
    ));

  it("brings a variant down", () =>
    withServer(
      async ({ call, client }) => {
        const response = await call("POST", "/api/variants/demo/down", { headers: JSON_HEADERS, body: "{}" });

        expect(response.status).toBe(200);
        expect(client.calls).toEqual(["down demo"]);
      },
      { records },
    ));

  it("answers 400 to implode without confirmation and leaves the variant alone", () =>
    withServer(
      async ({ call, client }) => {
        for (const body of ["{}", '{"confirm":false}', '{"confirm":"true"}', ""]) {
          const response = await call("POST", "/api/variants/demo/implode", { headers: JSON_HEADERS, body });

          expect(response.status).toBe(400);
        }
        expect(client.calls).toEqual([]);
      },
      { records },
    ));

  it("implodes with confirmation", () =>
    withServer(
      async ({ call, client }) => {
        const response = await call("POST", "/api/variants/demo/implode", {
          headers: JSON_HEADERS,
          body: '{"confirm":true}',
        });

        expect(response.status).toBe(200);
        expect(client.calls).toEqual(["implode demo"]);
      },
      { records },
    ));

  it("never implodes main", () =>
    withServer(
      async ({ call, client }) => {
        const response = await call("POST", "/api/variants/main/implode", {
          headers: JSON_HEADERS,
          body: '{"confirm":true}',
        });

        expect(response.status).toBe(400);
        expect(client.calls).toEqual([]);
      },
      { records },
    ));

  it("answers 404 for an unknown slug but treats main as known", () =>
    withServer(
      async ({ call, client }) => {
        expect((await call("POST", "/api/variants/nope/watch", { headers: JSON_HEADERS, body: "{}" })).status).toBe(
          404,
        );
        expect(client.calls).toEqual([]);

        expect((await call("POST", "/api/variants/main/watch", { headers: JSON_HEADERS, body: "{}" })).status).toBe(
          200,
        );
        expect(client.calls).toEqual(["watch main"]);
      },
      { records: [record("demo")] },
    ));

  it("answers 500 with the error message when the action fails", () =>
    withServer(
      async ({ call, client }) => {
        client.failNext("Variant demo is not merged into main");

        const response = await call("POST", "/api/variants/demo/implode", {
          headers: JSON_HEADERS,
          body: '{"confirm":true}',
        });

        expect(response.status).toBe(500);
        expect(JSON.parse(response.body)).toEqual({ error: "Variant demo is not merged into main" });
      },
      { records },
    ));

  it("answers 415 to any other content type and runs nothing", () =>
    withServer(
      async ({ call, client }) => {
        for (const type of ["text/plain", "application/x-www-form-urlencoded", undefined]) {
          const response = await call("POST", "/api/variants/demo/watch", {
            headers: { "content-type": type },
            body: "{}",
          });

          expect(response.status).toBe(415);
        }
        expect(client.calls).toEqual([]);
      },
      { records },
    ));

  it("answers 400 to a body that is not JSON", () =>
    withServer(
      async ({ call, client }) => {
        const response = await call("POST", "/api/variants/demo/watch", { headers: JSON_HEADERS, body: "{nope" });

        expect(response.status).toBe(400);
        expect(client.calls).toEqual([]);
      },
      { records },
    ));

  it("needs the token", () =>
    withServer(
      async ({ call, client }) => {
        const response = await call("POST", "/api/variants/demo/watch", {
          auth: false,
          headers: JSON_HEADERS,
          body: "{}",
        });

        expect(response.status).toBe(401);
        expect(client.calls).toEqual([]);
      },
      { records },
    ));

  it("does not run an action for a GET", () =>
    withServer(
      async ({ call, client }) => {
        expect((await call("GET", "/api/variants/demo/watch")).status).toBe(404);
        expect(client.calls).toEqual([]);
      },
      { records },
    ));
});
