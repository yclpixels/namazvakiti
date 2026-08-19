/* ============================================================
   tools/faz2_1-fix-ramadan-banner-css.js — FAZ 2.1: kritik CSS
   özgüllük hatasını düzeltir.
   ------------------------------------------------------------
   Sorun: `.ramadan-banner{display:flex;...}` kuralı, tarayıcının
   varsayılan `[hidden]{display:none}` kuralıyla AYNI özgüllüğe
   (0,1,0) sahip. Yazar CSS'i UA stylesheet'inden SONRA uygulandığı
   için `display:flex` kazanıyor — JS doğru şekilde hidden=true
   yapsa bile banner GÖRSEL OLARAK GÖRÜNÜR kalıyor (canlı sitede
   doğrulandı: computedDisplay="flex", offsetHeight=68, Ramazan
   olmamasına rağmen "Ramazan Ayındasınız" gösteriliyordu).

   Aynı dosyada `.stat-card[hidden]{display:none;}` kuralı zaten
   doğru şekilde var — aynı deseni `.ramadan-banner` için de
   uyguluyoruz.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const dataset = require("./data/turkey-il-ilce.json");

const OLD = `.ramadan-banner{display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(199,123,107,.16),rgba(125,74,140,.08));border:1px solid rgba(199,123,107,.35);border-radius:14px;padding:14px 16px;margin-bottom:18px;}`;
const NEW = `.ramadan-banner{display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(199,123,107,.16),rgba(125,74,140,.08));border:1px solid rgba(199,123,107,.35);border-radius:14px;padding:14px 16px;margin-bottom:18px;}\n  .ramadan-banner[hidden]{display:none;}`;

let fixed = 0, alreadyOk = 0, notFound = 0;
function fix(file) {
  let html = fs.readFileSync(file, "utf8");
  if (html.includes(".ramadan-banner[hidden]")) { alreadyOk++; return; }
  if (!html.includes(OLD)) { notFound++; console.log("UYARI: .ramadan-banner kuralı beklenen formatta değil ->", file); return; }
  html = html.replace(OLD, NEW);
  fs.writeFileSync(file, html, "utf8");
  fixed++;
}

fix(path.join(ROOT, "index.html"));
for (const p of dataset.provinces) {
  fix(path.join(ROOT, `${p.slug}.html`));
  for (const d of p.districts) {
    const distPath = path.join(ROOT, p.slug, d.slug, "index.html");
    if (fs.existsSync(distPath)) fix(distPath);
  }
}
console.log("Düzeltilen:", fixed, "Zaten sağlam:", alreadyOk, "Bulunamadı/farklı format:", notFound);
