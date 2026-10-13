export interface StaticSiteOptions {
  /** The host name the site answers for; `_` (any) without one. */
  host?: string;
  /** Requests below `path` go to `upstream`, WebSocket upgrades included. */
  proxy?: { path: string; upstream: string };
}

/** The directory the web server image serves files from. */
export const STATIC_ROOT = "/usr/share/nginx/html";

/** The host name of a URL, or nothing when it is not one. */
export const hostOf = (url: string | undefined): string | undefined =>
  url !== undefined && URL.canParse(url) ? new URL(url).hostname : undefined;

/**
 * The web server configuration of a static instance: files from `STATIC_ROOT`, `index.html` for every path that is not
 * a file, and the optional proxy for an API path. `upstream` is the base URL of the proxy target without the path.
 */
export const staticSiteConfig = ({ host, proxy }: StaticSiteOptions): string => {
  const lines = [
    "server {",
    "  listen 80;",
    `  server_name ${host ?? "_"};`,
    `  root ${STATIC_ROOT};`,
    "  index index.html;",
    "",
    "  location / {",
    "    try_files $uri $uri/ /index.html;",
    "  }",
  ];
  if (proxy) {
    lines.push(
      "",
      `  location ${proxy.path} {`,
      `    proxy_pass ${proxy.upstream}${proxy.path};`,
      "    proxy_http_version 1.1;",
      "    proxy_set_header Host $host;",
      "    proxy_set_header X-Real-IP $remote_addr;",
      "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
      "    proxy_set_header Upgrade $http_upgrade;",
      '    proxy_set_header Connection "upgrade";',
      "  }",
    );
  }
  lines.push("}", "");
  return lines.join("\n");
};
