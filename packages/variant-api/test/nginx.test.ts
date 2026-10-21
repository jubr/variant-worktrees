import { describe, expect, it } from "bun:test";
import { hostOf, staticSiteConfig } from "../src/nginx.js";

describe("static site configuration", () => {
  it("serves files and falls back to index.html", () => {
    const text = staticSiteConfig({});

    expect(text).toContain("root /usr/share/nginx/html;");
    expect(text).toContain("try_files $uri $uri/ /index.html;");
    expect(text).not.toContain("proxy_pass");
  });

  it("answers for the given host, otherwise for any", () => {
    expect(staticSiteConfig({ host: "demo.vw.localhost" })).toContain("server_name demo.vw.localhost;");
    expect(staticSiteConfig({})).toContain("server_name _;");
  });

  it("forwards the proxy path with WebSocket upgrades", () => {
    const text = staticSiteConfig({ proxy: { path: "/api/", upstream: "http://v-be-demo:3000" } });

    expect(text).toContain("location /api/ {");
    expect(text).toContain("proxy_pass http://v-be-demo:3000/api/;");
    expect(text).toContain("proxy_set_header Upgrade $http_upgrade;");
    expect(text).toContain('proxy_set_header Connection "upgrade";');
  });

  it("takes the host name from a URL", () => {
    expect(hostOf("http://demo.vw.localhost:62060/x")).toBe("demo.vw.localhost");
    expect(hostOf("not a url")).toBeUndefined();
    expect(hostOf(undefined)).toBeUndefined();
  });
});
