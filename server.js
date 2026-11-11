#!/usr/bin/env node
/**
 * FrameForge 本地静态服务器（零依赖）
 * 用法: node server.js [端口]   默认 8123
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.argv[2]) || 8123;
const ROOT = path.join(__dirname, "web");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

  /* ---------- Mock AI 端点（自测三协议用） ---------- */
  if (urlPath.startsWith("/mock/")) {
    return handleMock(req, res, urlPath);
  }

  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 Not Found: " + urlPath);
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
    res.end(data);
  });
});

/* 一个 1x1 PNG，用于 mock 生成结果 */
const MOCK_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function handleMock(req, res, urlPath) {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    if (urlPath.includes(":generateContent")) {
      // Gemini 原生格式
      return res.end(JSON.stringify({
        candidates: [{
          content: { parts: [{ inlineData: { mimeType: "image/png", data: MOCK_PNG } }] }
        }]
      }));
    }
    if (urlPath.includes("/chat/completions")) {
      // OpenAI 兼容 Chat：交替返回两种形态（markdown dataURI / message.images）
      const reqBody = safeJson(body);
      const variant = (reqBody.messages || []).length % 2 === 0;
      const dataUrl = "data:image/png;base64," + MOCK_PNG;
      const msg = variant
        ? { role: "assistant", content: "![generated](" + dataUrl + ")" }
        : { role: "assistant", content: "", images: [{ image_url: { url: dataUrl } }] };
      return res.end(JSON.stringify({ choices: [{ message: msg }] }));
    }
    if (urlPath.includes("/images/")) {
      // OpenAI 兼容 Images
      return res.end(JSON.stringify({ data: [{ b64_json: MOCK_PNG }] }));
    }
    res.writeHead(404);
    res.end("{}");
  });
}

function safeJson(s) {
  try { return JSON.parse(s || "{}"); } catch (e) { return {}; }
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`FrameForge 已启动: http://127.0.0.1:${PORT}`);
  console.log("按 Ctrl+C 停止");
});
