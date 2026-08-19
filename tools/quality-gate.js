/* FAZ 2U — SEO Quality Gate: 973 ilçe sayfasının tamamını denetler. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const dataset = require("./data/turkey-il-ilce.json");

const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const robots = fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8");
const hasDisallow = /Disallow:\s*\/\S/.test(robots);

const titles = new Map(); // title -> [paths]
const canonicals = new Map();
const results = [];
let passCount = 0;

for (const p of dataset.provinces) {
  for (const d of p.districts) {
    const rel = `${p.slug}/${d.slug}/index.html`;
    const full = path.join(ROOT, rel);
    const checks = {};
    checks["200 (dosya var)"] = fs.existsSync(full);
    if (!checks["200 (dosya var)"]) { results.push({ rel, checks, fail: ["200 (dosya var)"] }); continue; }

    const html = fs.readFileSync(full, "utf8");
    const titleM = html.match(/<title>([^<]*)<\/title>/);
    const canonicalM = html.match(/<link rel="canonical" href="([^"]*)"\/>/);
    const dataCityM = html.match(/data-city="([^"]+)"/);
    const dataDistM = html.match(/data-district="([^"]+)"/);
    const h1Matches = [...html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/g)];
    const expectedUrl = `https://namazvakiti.net/${p.slug}/${d.slug}/`;

    checks["canonical doğru"] = !!canonicalM && canonicalM[1] === expectedUrl;
    checks["title benzersiz metin içeriyor"] = !!titleM && titleM[1].includes(d.name);
    checks["tek H1"] = h1Matches.length === 1;
    checks["H1 doğru ilçe adını içeriyor"] = h1Matches.length === 1 && h1Matches[0][1].includes(d.name);
    checks["doğru province (data-city)"] = !!dataCityM && dataCityM[1] === p.name;
    checks["doğru district (data-district)"] = !!dataDistM && dataDistM[1] === d.name;
    checks["namaz vakti verisi mevcut (canlı API'de doğrulandı)"] = d.dataAvailable === true;
    checks["breadcrumb nav var"] = html.includes('aria-label="breadcrumb"');
    checks["BreadcrumbList JSON-LD var"] = html.includes('"BreadcrumbList"');
    checks["sitemap'te var"] = sitemap.includes(`<loc>${expectedUrl}</loc>`);
    checks["robots tarafından engellenmiyor"] = !hasDisallow; // site genelinde Disallow yok
    checks["noindex değil"] = !html.includes('name="robots" content="noindex"');
    checks["boş içerik değil (intro paragraf var)"] = /<p style="color:rgba\(245,240,230,\.55\)/.test(html);
    checks["FAQ içerik var (FAQPage schema kullanımı doğru)"] = html.includes('"FAQPage"') && html.includes("faq-item");

    if (titleM) { const arr = titles.get(titleM[1]) || []; arr.push(rel); titles.set(titleM[1], arr); }
    if (canonicalM) { const arr = canonicals.get(canonicalM[1]) || []; arr.push(rel); canonicals.set(canonicalM[1], arr); }

    const fail = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    results.push({ rel, checks, fail });
    if (fail.length === 0) passCount++;
  }
}

// Duplicate title/canonical taraması (ayrı, global kontrol)
const dupTitles = [...titles.entries()].filter(([, arr]) => arr.length > 1);
const dupCanonicals = [...canonicals.entries()].filter(([, arr]) => arr.length > 1);

console.log("=== FAZ 2U SEO QUALITY GATE ===");
console.log("Toplam denetlenen ilçe sayfası:", results.length);
console.log("Tüm kontrolleri geçen:", passCount);
console.log("En az 1 kontrolü başarısız olan:", results.length - passCount);
console.log("Duplicate title:", dupTitles.length);
console.log("Duplicate canonical:", dupCanonicals.length);

const failed = results.filter((r) => r.fail.length > 0);
if (failed.length) {
  console.log("\n--- BAŞARISIZ SAYFALAR (ilk 30) ---");
  failed.slice(0, 30).forEach((r) => console.log(r.rel, "->", r.fail.join(", ")));
}
if (dupTitles.length) {
  console.log("\n--- DUPLICATE TITLE'LAR (ilk 10) ---");
  dupTitles.slice(0, 10).forEach(([t, arr]) => console.log(JSON.stringify(t), "->", arr.join(", ")));
}

fs.writeFileSync(path.join(ROOT, "tools", "data", "faz2-quality-gate-results.json"), JSON.stringify({
  totalChecked: results.length, passCount, failCount: results.length - passCount,
  dupTitleCount: dupTitles.length, dupCanonicalCount: dupCanonicals.length,
  failedPages: failed,
}, null, 2), "utf8");
console.log("\nTam sonuçlar: tools/data/faz2-quality-gate-results.json");
