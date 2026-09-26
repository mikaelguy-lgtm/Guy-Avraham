// שרת פיתוח/QA לאתר הציבורי: מגיש את marketing/dist כמו ה-nginx בייצור (pretty URLs, 404 אמיתי)
// ומעביר את שלושת ה-endpoints הציבוריים ל-API המקומי. לא לשימוש בייצור.
// הרצה: node marketing/serve-dev.mjs [port=4180] [api=http://localhost:3000]
/* global console, process */
import {createServer, request as httpRequest} from "node:http";
import {readFile, stat} from "node:fs/promises";
import {extname, join} from "node:path";
import {dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.argv[2] ?? 4180);
const api = new URL(process.argv[3] ?? "http://localhost:3000");
const types = {".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json"};
const publicApi = [/^\/api\/public\/site-settings$/, /^\/api\/legal-documents\/(TERMS|PRIVACY|DPA)$/, /^\/api\/privacy-requests$/];

async function serveFile(path, response, status = 200) {
  const body = await readFile(path);
  response.writeHead(status, {"content-type": types[extname(path)] ?? "application/octet-stream", "content-length": body.length});
  response.end(body);
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  if (publicApi.some((pattern) => pattern.test(url.pathname))) {
    const upstream = httpRequest({hostname: api.hostname, port: api.port, path: url.pathname + url.search, method: request.method, headers: {...request.headers, host: api.host, origin: "", cookie: ""}}, (res) => {
      response.writeHead(res.statusCode ?? 502, res.headers);
      res.pipe(response);
    });
    upstream.on("error", () => { response.writeHead(502); response.end(); });
    request.pipe(upstream);
    return;
  }
  if (url.pathname.startsWith("/api/")) { response.writeHead(404); response.end(); return; }
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes("..")) { response.writeHead(400); response.end(); return; }
  const candidates = pathname.endsWith("/") ? [join(root, pathname, "index.html")] : [join(root, pathname)];
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) { await serveFile(candidate, response); return; }
      if (info.isDirectory()) { response.writeHead(301, {location: `${url.pathname}/`}); response.end(); return; }
    } catch { /* next */ }
  }
  await serveFile(join(root, "404.html"), response, 404);
}).listen(port, "127.0.0.1", () => console.log(`marketing dev server: http://127.0.0.1:${port} (api -> ${api.origin})`));
