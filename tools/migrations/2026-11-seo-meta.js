/* SEO meta düzenlemeleri — idempotent.
   - Ana sayfa: başlık/açıklama arama niyetine göre (81 il + 973 ilçe, imsakiye),
     og/twitter etiketleri başlıkla aynı
   - Zikirmatik: 160 karakteri aşan açıklama kısaltıldı
   - Dizinlenen tüm sayfalara robots meta: büyük görsel önizleme ve tam snippet izni */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const SKIP_DIRS = new Set([".git", ".github", ".claude", ".wrangler", "node_modules", "tools", "docs", "internal-notes", "assets", "worker"]);
const NOINDEX = new Set(["404.html", "offline.html"]);
const ROBOTS = '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"/>';

const HOME_TITLE = "Namaz Vakitleri 2026 – 81 İl ve 973 İlçe Ezan Saatleri";
const HOME_DESC = "81 il ve 973 ilçe için Diyanet kaynaklı güncel namaz vakitleri: imsak, öğle, ikindi, akşam ve yatsı ezan saatleri, aylık imsakiye ve kıble pusulası.";
const ZIKIR_OLD = "Ücretsiz online zikirmatik: dokun ve say. 33, 99, 100 veya kendi hedefiniz, tur sayacı, titreşim ve zikir başına ayrı kayıt. Uygulama indirmeden telefonda çalışır.";
const ZIKIR_NEW = "Ücretsiz online zikirmatik: dokun ve say. 33, 99, 100 veya kendi hedefiniz, tur sayacı ve titreşim. Uygulama indirmeden telefonda çalışır.";

const setMeta = (h, sel, value) => h.replace(new RegExp(`(<meta ${sel} content=")[^"]*(")`), `$1${value}$2`);

function fix(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  if (NOINDEX.has(rel) || /^google[0-9a-f]+\.html$/.test(rel)) return 0;
  let h = fs.readFileSync(file, "utf8");
  const before = h;

  if (rel === "index.html") {
    h = h.replace(/<title>[^<]*<\/title>/, `<title>${HOME_TITLE}</title>`);
    h = setMeta(h, 'name="description"', HOME_DESC);
    h = setMeta(h, 'property="og:title"', HOME_TITLE);
    h = setMeta(h, 'property="og:description"', HOME_DESC);
    h = setMeta(h, 'name="twitter:title"', HOME_TITLE);
    h = setMeta(h, 'name="twitter:description"', HOME_DESC);
  }
  h = h.split(ZIKIR_OLD).join(ZIKIR_NEW);

  if (!h.includes('name="robots"')) {
    h = h.replace(/(<meta name="description" content="[^"]*"\/>)/, `$1\n${ROBOTS}`);
    if (!h.includes('name="robots"')) throw new Error(rel + ": description meta bulunamadı");
  }

  if (h !== before) { fs.writeFileSync(file, h, "utf8"); return 1; }
  return 0;
}

let changed = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); }
    else if (e.name.endsWith(".html")) changed += fix(path.join(dir, e.name));
  }
})(ROOT);
console.log("Toplam güncellenen dosya:", changed);
