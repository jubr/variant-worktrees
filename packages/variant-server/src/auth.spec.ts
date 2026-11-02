import { describe, expect, it } from "bun:test";
import { connect } from "node:net";
import { networkInterfaces } from "node:os";
import { record, withServer } from "./test-support.js";

describe("token and host check", () => {
  it("answers 401 without a token and no detail in the body", () =>
    withServer(async ({ call }) => {
      const response = await call("GET", "/api/variants", { auth: false });

      expect(response.status).toBe(401);
      expect(response.body).toBe("");
    }));

  it("answers 401 for a wrong bearer token", () =>
    withServer(async ({ call }) => {
      const response = await call("GET", "/api/variants", { headers: { authorization: "Bearer wrong" } });

      expect(response.status).toBe(401);
    }));

  it("accepts the token as a bearer header", () =>
    withServer(
      async ({ call }) => {
        expect((await call("GET", "/api/variants")).status).toBe(200);
      },
      { records: [record("demo")] },
    ));

  it("exchanges the token of a first visit for an HttpOnly SameSite=Strict cookie and redirects without it", () =>
    withServer(async ({ call, token }) => {
      const first = await call("GET", `/?token=${token}`, { auth: false });

      expect(first.status).toBe(302);
      expect(first.headers.location).toBe("/");
      const cookie = String(first.headers["set-cookie"]);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Strict");
      expect(cookie).not.toContain("Secure");

      const second = await call("GET", "/api/variants", {
        auth: false,
        headers: { cookie: cookie.split(";")[0] },
      });
      expect(second.status).toBe(200);
    }));

  it("keeps the rest of the query when it redirects", () =>
    withServer(async ({ call, token }) => {
      const first = await call("GET", `/variants/demo?token=${token}&view=compact`, { auth: false });

      expect(first.status).toBe(302);
      expect(first.headers.location).toBe("/variants/demo?view=compact");
    }));

  it("answers 401 for a wrong token in the query and sets no cookie", () =>
    withServer(async ({ call }) => {
      const response = await call("GET", "/?token=nope", { auth: false });

      expect(response.status).toBe(401);
      expect(response.headers["set-cookie"]).toBeUndefined();
    }));

  it("answers 421 for a foreign host name, before the token is checked", () =>
    withServer(async ({ call, port }) => {
      const valid = await call("GET", "/api/variants", { headers: { host: `evil.example:${port}` } });
      const withoutToken = await call("GET", "/api/variants", {
        auth: false,
        headers: { host: `evil.example:${port}` },
      });

      expect(valid.status).toBe(421);
      expect(withoutToken.status).toBe(421);
    }));

  it("answers 421 for the right name on another port", () =>
    withServer(async ({ call, port }) => {
      const response = await call("GET", "/api/variants", { headers: { host: `localhost:${port + 1}` } });

      expect(response.status).toBe(421);
    }));

  it.each(["ui.vw.localhost", "localhost", "127.0.0.1"])("accepts the host %s with the server's port", (name) =>
    withServer(async ({ call, port }) => {
      const response = await call("GET", "/api/variants", { headers: { host: `${name}:${port}` } });

      expect(response.status).toBe(200);
    }));

  it("generates a token of at least 128 bits, different for every run", async () => {
    const tokens: string[] = [];
    await withServer(async ({ token }) => {
      tokens.push(token);
      await withServer(async ({ token: other }) => {
        tokens.push(other);
      });
    });

    expect(tokens[0]).toMatch(/^[A-Za-z0-9_-]{22,}$/);
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it("listens on the loopback interface only", () =>
    withServer(async ({ port, origin }) => {
      expect(origin).toBe(`http://127.0.0.1:${port}`);
      const outside = Object.values(networkInterfaces())
        .flat()
        .find((address) => address && !address.internal && address.family === "IPv4");
      if (outside === undefined) {
        return;
      }

      const refused = await new Promise<boolean>((resolve) => {
        const socket = connect({ host: outside.address, port });
        socket.once("connect", () => {
          socket.destroy();
          resolve(false);
        });
        socket.once("error", () => resolve(true));
        // A firewall may drop the attempt instead of refusing it; what must not happen is a connection.
        setTimeout(() => {
          socket.destroy();
          resolve(true);
        }, 1000);
      });
      expect(refused).toBe(true);
    }));
});
