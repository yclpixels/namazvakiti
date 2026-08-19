/* FAZ 1F — düzeltilmiş favicon PNG'lerini <head>'e ekle (anasayfa + il + ilçe) */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const OLD = `<link rel="icon" href="/favicon.ico"/>`;
const NEW = `<link rel="icon" href="/favicon.ico"/>
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32-v2.png"/>
<link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16-v2.png"/>`;

let changed = 0;
function fix(file) {
  let html = fs.readFileSync(file, "utf8");
  if (html.includes(NEW)) return; // zaten eklenmiş
  if (!html.includes(OLD)) { console.log("UYARI: favicon.ico linki yok ->", file); return; }
  html = html.replace(OLD, NEW);
  fs.writeFileSync(file, html, "utf8");
  changed++;
}

fix(path.join(ROOT, "index.html"));
const EXCLUDE = new Set(["index.html", "404.html", "offline.html", "gizlilik.html", "hakkimizda.html", "iletisim.html", "kullanim.html", "sehirler.html", "namaz-vakitleri-nasil-hesaplanir.html", "google30951a8846720cf2.html", "google44f179ad667a5f85.html"]);
const rootFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !EXCLUDE.has(f));
for (const f of rootFiles) fix(path.join(ROOT, f));

const provinceDirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory() && rootFiles.includes(d.name + ".html"));
for (const pd of provinceDirs) {
  const provDir = path.join(ROOT, pd.name);
  for (const dd of fs.readdirSync(provDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const idx = path.join(provDir, dd.name, "index.html");
    if (fs.existsSync(idx)) fix(idx);
  }
}
console.log("Toplam güncellenen dosya:", changed);
