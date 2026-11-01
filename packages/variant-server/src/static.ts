import { readFileSync, statSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The built variants app, as a directory or as a map from the file's path in the app (`index.html`, `chunk.js`) to where it is. */
export type StaticApp = string | Readonly<Record<string, string>>;

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

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** A file of the app: where it is, and the name that tells its content type (an embedded file's own name is a hash). */
interface AppFile {
  path: string;
  name: string;
}

const fileAt = (app: StaticApp, requestPath: string): AppFile | undefined => {
  if (typeof app !== "string") {
    // Only the listed names: a request path never reaches a file the map does not name.
    const name = requestPath.replace(/^\/+/, "");
    const listed = Object.hasOwn(app, name) ? app[name] : undefined;
    return listed !== undefined && isFile(listed) ? { path: listed, name } : undefined;
  }
  const root = resolve(app);
  const candidate = normalize(join(root, requestPath));
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return undefined;
  }
  return isFile(candidate) ? { path: candidate, name: candidate } : undefined;
};

/** The app: the file the path names, or `index.html` for every path that is not a file. */
export const serveApp = (response: ServerResponse, app: StaticApp, requestPath: string, head: boolean): void => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    decoded = "/";
  }
  const file = fileAt(app, decoded) ?? fileAt(app, "index.html");
  if (file === undefined) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    "content-type": CONTENT_TYPES[extname(file.name)] ?? "application/octet-stream",
    "content-security-policy": CONTENT_SECURITY_POLICY,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  response.end(head ? undefined : readFileSync(file.path));
};
