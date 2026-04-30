const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { fetchYouTubePublishedDate, getYouTubeVideoId } = require("./youtube-meta");

const rootDir = __dirname;
const port = Number(process.env.PORT || 3042);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp"
};

const blockedPatterns = [
  /^artifacts(\/|$)/i,
  /^node_modules(\/|$)/i,
  /^\./,
  /^firebase\.json$/i,
  /^firestore\.rules$/i,
  /^package(-lock)?\.json$/i,
  /^server\.js$/i,
  /^youtube-meta\.js$/i,
  /^start-dialectichub\.bat$/i,
  /^start-dialectichub\.cmd$/i,
  /^verify-server\.log$/i
];

function resolveRequestedPath(requestUrl) {
  const parsed = new URL(requestUrl, `http://127.0.0.1:${port}`);
  const pathname = decodeURIComponent(parsed.pathname);
  const target = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const normalizedTarget = target.replace(/\\/g, "/");

  if (blockedPatterns.some((pattern) => pattern.test(normalizedTarget))) {
    return null;
  }

  const fullPath = path.normalize(path.join(rootDir, target));
  if (!fullPath.startsWith(rootDir)) {
    return null;
  }

  return fullPath;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Cache-Control": statusCode === 200 ? "public, max-age=3600" : "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

async function handleYouTubePublishedDateRequest(req, res, parsedUrl) {
  if (req.method !== "GET") {
    res.writeHead(405, {
      "Allow": "GET",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    });
    res.end(JSON.stringify({ error: "METHOD_NOT_ALLOWED", publishedDate: "" }));
    return;
  }

  const videoId = getYouTubeVideoId(parsedUrl.searchParams.get("videoId") || parsedUrl.searchParams.get("url") || "");
  if (!videoId) {
    sendJson(res, 400, { error: "INVALID_VIDEO_ID", publishedDate: "" });
    return;
  }

  try {
    const publishedDate = await fetchYouTubePublishedDate(videoId);
    if (!publishedDate) {
      sendJson(res, 404, { videoId, publishedDate: "" });
      return;
    }

    sendJson(res, 200, { videoId, publishedDate });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 0) === 400 ? 400 : 502;
    sendJson(res, statusCode, {
      error: statusCode === 400 ? "INVALID_VIDEO_ID" : "YOUTUBE_DATE_UNAVAILABLE",
      videoId,
      publishedDate: ""
    });
  }
}

async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  if (parsedUrl.pathname === "/api/youtube-published-date") {
    await handleYouTubePublishedDateRequest(req, res, parsedUrl);
    return;
  }

  const filePath = resolveRequestedPath(req.url || "/");
  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, fileBuffer) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Not found: ${path.relative(rootDir, filePath)}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    res.end(fileBuffer);
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("DialecticHub server error", error);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("DialecticHub hit an unexpected local server error.");
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`DialecticHub running at http://127.0.0.1:${port}`);
});
