import { readFileSync, statSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The built variants app: the `dist` directory of the `variant-ui` package. */
export const defaultStaticDir = (): string =>
  join(dirname(fileURLToPath(import.meta.resolve("variant-ui/package.json"))), "dist");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/**
 * AIDEV-NOTE: the codicon font is inlined into the stylesheet as a data URL, so `font-src` needs `data:`. Everything
 * else comes from the server itself; no inline script or style.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self' data:",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const fileAt = (root: string, requestPath: string): string | undefined => {
  const candidate = normalize(join(root, requestPath));
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return undefined;
  }
  try {
    return statSync(candidate).isFile() ? candidate : undefined;
  } catch {
    return undefined;
  }
};

/** The app: the file the path names, or `index.html` for every path that is not a file. */
export const serveApp = (response: ServerResponse, root: string, requestPath: string, head: boolean): void => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    decoded = "/";
  }
  const file = fileAt(root, decoded) ?? fileAt(root, "index.html");
  if (file === undefined) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    "content-security-policy": CONTENT_SECURITY_POLICY,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  response.end(head ? undefined : readFileSync(file));
};
