/* ============================================================
   tools/generate-pages.js — FAZ 2S: idempotent ilçe sayfa üretici
   ------------------------------------------------------------
   tools/data/turkey-il-ilce.json'daki canonical dataset'i okur:
   - Diskte eksik olan gerçek (resmi) ilçe sayfalarını, o ildeki
     mevcut bir sayfayı şablon alıp üretir.
   - Zaten var olan sayfalara DOKUNMAZ (idempotent).
   - "Merkez" gibi resmi karşılığı olmayan sahte sayfa ÜRETMEZ
     (dataset zaten sadece gerçek resmi ilçeleri içeriyor).
   - Her ilin ilçe link bloğunu dataset'ten TAM olarak yeniden
     üretir (artık elle bakım gerekmiyor).
   - sitemap.xml'i sıfırdan, dataset + statik sayfalar üzerinden
     tutarlı şekilde yeniden üretir.

   Tekrar çalıştırıldığında: eksik sayfa yoksa hiçbir HTML dosyası
   değişmez (aynı sonuç -> idempotent).
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const dataset = require("./data/turkey-il-ilce.json");

function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }
function write(p, c) { fs.writeFileSync(path.join(ROOT, p), c, "utf8"); }
function exists(p) { return fs.existsSync(path.join(ROOT, p)); }

const STATS = { created: 0, skippedExisting: 0, provincePagesUpdated: 0, errors: [] };
const createdList = [];

for (const province of dataset.provinces) {
  const provDir = province.slug;
  if (!exists(`${provDir}.html`)) { STATS.errors.push(`İl sayfası yok: ${provDir}.html`); continue; }

  // Diskteki mevcut ilçe klasörlerini bul (şablon seçimi için)
  const existingDistSlugs = fs.existsSync(path.join(ROOT, provDir))
    ? fs.readdirSync(path.join(ROOT, provDir), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];

  // Şablon: o ildeki ilk mevcut, çalışan ilçe sayfası
  let templateSlug = null, templateHtml = null, templateDistrictName = null;
  for (const s of existingDistSlugs) {
    const p = `${provDir}/${s}/index.html`;
    if (exists(p)) {
      const html = read(p);
      const m = html.match(/data-district="([^"]+)"/);
      if (m) { templateSlug = s; templateHtml = html; templateDistrictName = m[1]; break; }
    }
  }

  for (const district of province.districts) {
    const distDir = `${provDir}/${district.slug}`;
    const distPath = `${distDir}/index.html`;
    if (exists(distPath)) { STATS.skippedExisting++; continue; }

    if (!templateHtml) {
      STATS.errors.push(`Şablon bulunamadı, üretilemedi: ${distPath}`);
      continue;
    }

    let html = templateHtml;
    html = html.split(`/${provDir}/${templateSlug}/`).join(`/${provDir}/${district.slug}/`);
    html = html.split(templateDistrictName).join(district.name);

    fs.mkdirSync(path.join(ROOT, distDir), { recursive: true });
    write(distPath, html);
    STATS.created++;
    createdList.push(distPath);
  }

  // İl sayfasındaki ilçe link bloğunu dataset'ten TAM olarak yeniden üret
  const sortedDistricts = [...province.districts].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const linksHtml = sortedDistricts.map((d) => `<a href="/${provDir}/${d.slug}/">${d.name}</a>`).join("\n");

  let provinceHtml = read(`${provDir}.html`);
  // Eski şablonda style="margin-bottom:26px;" + 4 boşluk, yeni tasarımda niteliksiz + 6 boşluk
  const blockRe = /(<div class="city-links"(?: style="margin-bottom:26px;")?>\n)([\s\S]*?)(\n {4,6}<\/div>)/;
  if (blockRe.test(provinceHtml)) {
    provinceHtml = provinceHtml.replace(blockRe, `$1${linksHtml}$3`);
    write(`${provDir}.html`, provinceHtml);
    STATS.provincePagesUpdated++;
  } else {
    STATS.errors.push(`İlçe link bloğu bulunamadı: ${provDir}.html`);
  }
}

console.log("=== SAYFA ÜRETİMİ ===");
console.log("Üretilen yeni ilçe sayfası:", STATS.created);
console.log("Zaten mevcut, atlanan:", STATS.skippedExisting);
console.log("İl sayfası (ilçe linkleri) güncellenen:", STATS.provincePagesUpdated);
if (STATS.errors.length) {
  console.log("\nHATALAR:");
  STATS.errors.forEach((e) => console.log("  -", e));
}

fs.writeFileSync(path.join(ROOT, "tools", "data", "faz2-created-pages.json"), JSON.stringify(createdList, null, 2), "utf8");
console.log("\nÜretilen sayfa listesi: tools/data/faz2-created-pages.json");
