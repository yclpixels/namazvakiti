/* Basit statik dosya sunucusu — sadece FAZ 2 içi yerel test için.
   Yeni bir dependency eklemez (sadece Node'un yerleşik http/fs modülleri). */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 8083;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".xml": "application/xml", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let full = path.join(ROOT, p);
  if (p.endsWith("/")) {
    full = path.join(full, "index.html");
  } else if (!path.extname(full) && fs.existsSync(full + ".html")) {
    // "/il" gibi uzantısız istekleri dene (Cloudflare Pages pretty-url davranışı).
    // Aynı adı taşıyan bir KLASÖR de olabilir (ör. istanbul/ ilçe klasörlerini
    // barındırır) — üretimdeki gibi .html dosyası her zaman önceliklidir.
    full = full + ".html";
  }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end("404"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => console.log("dev server: http://localhost:" + PORT));
