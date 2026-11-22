import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || "127.0.0.1";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(text);
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let pathname;

  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    sendText(response, 400, "Bad request");
    return;
  }

  const relativePath = pathname.endsWith("/")
    ? `${pathname}index.html`
    : pathname;
  const filePath = path.resolve(ROOT, `.${relativePath}`);

  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");

    response.writeHead(200, {
      "Content-Type":
        MIME_TYPES.get(path.extname(filePath).toLowerCase()) ||
        "application/octet-stream",
      "Content-Length": fileStat.size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, 404, "Not found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`小满已启动：http://${HOST}:${PORT}`);
  console.log("用 iPhone 安装时，需要部署到 HTTPS 地址。");
});
