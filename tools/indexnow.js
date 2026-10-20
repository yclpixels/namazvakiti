/* ============================================================
   tools/indexnow.js — değişen sayfaları IndexNow'a bildirir
   (Bing, Yandex, Seznam, Naver… tek istekte paylaşılır).
   ------------------------------------------------------------
   Kullanım: node tools/indexnow.js <değişen dosya yolları...>
   CI'da main'e push sonrası, push'taki değişen dosyalarla çalışır.
   Anahtar dosyası kökteki <KEY>.txt (anahtar tanım gereği herkese açık).
   Yalnızca sitemap'te bulunan URL'ler gönderilir.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const HOST = "namazvakiti.net";

const keyFile = fs.readdirSync(ROOT).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.error("IndexNow anahtar dosyası yok"); process.exit(1); }
const key = keyFile.slice(0, -4);

const inSitemap = new Set([...fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

function toUrl(file) {
  const f = file.replace(/\\/g, "/");
  if (!f.endsWith(".html")) return null;
  if (f === "index.html") return `https://${HOST}/`;
  if (f.endsWith("/index.html")) return `https://${HOST}/${f.slice(0, -"index.html".length)}`;
  return `https://${HOST}/${f.slice(0, -".html".length)}`;
}

const urls = [...new Set(process.argv.slice(2).map(toUrl).filter((u) => u && inSitemap.has(u)))];
if (!urls.length) { console.log("Bildirilecek sayfa yok"); process.exit(0); }

(async () => {
  // API tek istekte en fazla 10.000 URL kabul eder
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList: urls.slice(0, 10000) }),
  });
  console.log(`IndexNow: ${urls.length} URL → HTTP ${res.status}`);
  if (res.status >= 400 && res.status !== 429) process.exit(1);
})();
