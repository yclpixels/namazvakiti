/* ============================================================
   tools/faz1e-h1-headings.js — FAZ 1E: H1 + heading hierarchy
   Anasayfa + tüm il + tüm ilçe sayfalarına gerçek, statik (JS'e
   bağımlı olmayan) tek bir <h1> ekler; .sec-title span'lerini
   <h2> yapar (CSS class-bazlı olduğu için görsel değişmez).
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const H1_STYLE = 'style="max-width:1100px;margin:10px auto 0;padding:0 22px;font-size:14px;font-weight:600;color:rgba(255,255,255,.9);letter-spacing:.2px;" class="serif"';

function h2ify(html) {
  return html.replace(/<span class="sec-title serif">([^<]*)<\/span>/g, '<h2 class="sec-title serif">$1</h2>');
}

function insertH1(html, text) {
  const anchor = '<div class="selectors">';
  if (!html.includes(anchor)) throw new Error("selectors anchor not found");
  if (html.includes("<h1 ")) return html; // zaten eklenmiş, tekrar ekleme
  const h1 = `<h1 ${H1_STYLE}>${text}</h1>\n  `;
  return html.replace(anchor, h1 + anchor);
}

let filesChanged = 0;

// 1) Anasayfa
{
  const p = "index.html";
  let html = fs.readFileSync(path.join(ROOT, p), "utf8");
  html = insertH1(html, "Namaz Vakitleri");
  html = h2ify(html);
  fs.writeFileSync(path.join(ROOT, p), html, "utf8");
  filesChanged++;
}

// 2) İl sayfaları ({il}.html, kök dizinde) — data-city attribute'undan isim çıkar
const EXCLUDE = new Set(["index.html", "404.html", "offline.html", "gizlilik.html", "hakkimizda.html", "iletisim.html", "kullanim.html", "sehirler.html", "namaz-vakitleri-nasil-hesaplanir.html", "google30951a8846720cf2.html", "google44f179ad667a5f85.html"]);
const rootFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !EXCLUDE.has(f));
for (const f of rootFiles) {
  const full = path.join(ROOT, f);
  let html = fs.readFileSync(full, "utf8");
  const m = html.match(/<body data-city="([^"]+)"/);
  if (!m) { console.log("UYARI: data-city bulunamadı ->", f); continue; }
  html = insertH1(html, `${m[1]} Namaz Vakitleri`);
  html = h2ify(html);
  fs.writeFileSync(full, html, "utf8");
  filesChanged++;
}

// 3) İlçe sayfaları ({il}/{ilce}/index.html) — data-district attribute'undan isim çıkar
const provinceDirs = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && rootFiles.includes(d.name + ".html"));

for (const pd of provinceDirs) {
  const provDir = path.join(ROOT, pd.name);
  const distDirs = fs.readdirSync(provDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dd of distDirs) {
    const idx = path.join(provDir, dd.name, "index.html");
    if (!fs.existsSync(idx)) continue;
    let html = fs.readFileSync(idx, "utf8");
    const m = html.match(/data-district="([^"]+)"/);
    if (!m) { console.log("UYARI: data-district bulunamadı ->", pd.name + "/" + dd.name); continue; }
    html = insertH1(html, `${m[1]} Namaz Vakitleri`);
    html = h2ify(html);
    fs.writeFileSync(idx, html, "utf8");
    filesChanged++;
  }
}

console.log(`Toplam güncellenen dosya: ${filesChanged}`);
