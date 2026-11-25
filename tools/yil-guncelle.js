/* Başlıklardaki yılı günceller (ör. "Namaz Vakitleri 2026" → 2027).
   Kullanım: node tools/yil-guncelle.js 2027
   İl/ilçe sayfalarında yılı canlıda Worker zaten günceller; bu araç statik
   HTML'deki <title>, og:title ve twitter:title'ı da hizalar (ana sayfa ve
   bilgi sayfaları Worker'dan geçmez). Her yılbaşında bir kez çalıştırın. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SKIP_DIRS = new Set([".git", ".github", ".claude", ".wrangler", "node_modules", "tools", "docs", "internal-notes", "assets", "worker"]);

const year = process.argv[2];
if (!/^20\d{2}$/.test(year || "")) { console.error("Kullanım: node tools/yil-guncelle.js <yıl>"); process.exit(1); }

const fixYear = (t) => t.replace(/\b20\d{2}\b/g, year);
let changed = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(full); continue; }
    if (!e.name.endsWith(".html")) continue;
    const h = fs.readFileSync(full, "utf8");
    const out = h
      .replace(/<title>[^<]*<\/title>/, fixYear)
      .replace(/<meta (property="og:title"|name="twitter:title") content="[^"]*"\/>/g, fixYear);
    if (out !== h) { fs.writeFileSync(full, out, "utf8"); changed++; }
  }
})(ROOT);
console.log(`Yıl ${year} olarak ayarlandı — güncellenen dosya: ${changed}`);
