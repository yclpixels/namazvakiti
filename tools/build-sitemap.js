/* ============================================================
   tools/faz2k-rebuild-sitemap.js — FAZ 2K: sitemap.xml'i sıfırdan,
   tutarlı ve doğrulanabilir şekilde yeniden üretir.
   ------------------------------------------------------------
   İçerik: anasayfa + canonical dataset'teki 973 ilçenin TAMAMI
   (artık hepsi diskte var) + 81 il sayfası + 6 statik sayfa.
   Hariç tutulanlar: 404.html (noindex), offline.html (PWA kabuğu),
   google doğrulama dosyaları, robots.txt/sitemap.xml/ads.txt (URL
   sitemap'e girmez).
   Sadece diskte GERÇEKTEN var olan (fs.existsSync) sayfalar
   eklenir — ghost/ölü URL sitemap'e giremez.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const dataset = require("./data/turkey-il-ilce.json");

const BASE = "https://namazvakiti.net";
const STATIC_PAGES = ["gizlilik.html", "hakkimizda.html", "iletisim.html", "kullanim.html", "namaz-vakitleri-nasil-hesaplanir.html", "sehirler.html"];

const entries = []; // {slug, url}
entries.push({ sortKey: "", url: `${BASE}/` });

for (const s of STATIC_PAGES) {
  const slug = s.replace(/\.html$/, "");
  if (fs.existsSync(path.join(ROOT, s))) entries.push({ sortKey: slug, url: `${BASE}/${slug}` });
  else console.log("UYARI: statik sayfa yok, sitemap'e eklenmedi:", s);
}

for (const p of dataset.provinces) {
  if (!fs.existsSync(path.join(ROOT, `${p.slug}.html`))) { console.log("UYARI: il sayfası yok:", p.slug); continue; }
  entries.push({ sortKey: p.slug, url: `${BASE}/${p.slug}`, isProvince: true, province: p });
}

entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

const lines = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">"];
let totalUrls = 0, missingDistrictPages = 0;

for (const e of entries) {
  lines.push(`  <url><loc>${e.url}</loc></url>`);
  totalUrls++;
  if (e.isProvince) {
    const sortedDistricts = [...e.province.districts].sort((a, b) => a.slug.localeCompare(b.slug));
    for (const d of sortedDistricts) {
      const distPath = path.join(ROOT, e.province.slug, d.slug, "index.html");
      if (!fs.existsSync(distPath)) { missingDistrictPages++; continue; } // sayfası yoksa sitemap'e girmez
      lines.push(`  <url><loc>${BASE}/${e.province.slug}/${d.slug}/</loc></url>`);
      totalUrls++;
    }
  }
}
lines.push("</urlset>");

fs.writeFileSync(path.join(ROOT, "sitemap.xml"), lines.join("\n") + "\n", "utf8");

console.log("sitemap.xml yeniden üretildi.");
console.log("Toplam URL:", totalUrls);
console.log("(Dataset'te olup diskte sayfası bulunmayan, sitemap'e eklenmeyen ilçe:", missingDistrictPages, ")");
