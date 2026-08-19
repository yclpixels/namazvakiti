/* FAZ 2O — BreadcrumbList JSON-LD ekle (81 il + 973 ilçe).
   Görsel breadcrumb (<nav aria-label="breadcrumb">) ile birebir aynı
   hiyerarşiyi temsil eder — Google'ın beklediği kullanım budur. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const dataset = require("./data/turkey-il-ilce.json");
const BASE = "https://www.namazvakiti.net";

function bcJson(items) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  });
}

const FAQ_SCRIPT_CLOSE = `</script>\n</head>`;
let ilUpdated = 0, ilceUpdated = 0, skipped = 0;

function inject(filePath, breadcrumbItems) {
  let html = fs.readFileSync(filePath, "utf8");
  if (html.includes('"BreadcrumbList"')) { skipped++; return false; }
  if (!html.includes(FAQ_SCRIPT_CLOSE)) { console.log("UYARI: FAQ script/head kapanışı bulunamadı ->", filePath); return false; }
  const tag = `<script type="application/ld+json">${bcJson(breadcrumbItems)}</script>\n</head>`;
  html = html.replace(FAQ_SCRIPT_CLOSE, tag);
  fs.writeFileSync(filePath, html, "utf8");
  return true;
}

for (const p of dataset.provinces) {
  const ilPath = path.join(ROOT, `${p.slug}.html`);
  if (fs.existsSync(ilPath)) {
    const items = [
      { name: "Ana Sayfa", url: `${BASE}/` },
      { name: "Şehirler", url: `${BASE}/sehirler.html` },
      { name: p.name, url: `${BASE}/${p.slug}.html` },
    ];
    if (inject(ilPath, items)) ilUpdated++;
  }
  for (const d of p.districts) {
    const distPath = path.join(ROOT, p.slug, d.slug, "index.html");
    if (!fs.existsSync(distPath)) continue;
    const items = [
      { name: "Ana Sayfa", url: `${BASE}/` },
      { name: p.name, url: `${BASE}/${p.slug}.html` },
      { name: d.name, url: `${BASE}/${p.slug}/${d.slug}/` },
    ];
    if (inject(distPath, items)) ilceUpdated++;
  }
}

console.log("İl sayfası BreadcrumbList eklenen:", ilUpdated);
console.log("İlçe sayfası BreadcrumbList eklenen:", ilceUpdated);
console.log("Zaten mevcut, atlanan:", skipped);
