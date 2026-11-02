/* AdSense otomatik reklam kodunu GA snippet'ini taşıyan tüm sayfalara ekle.
   Yayıncı ID'si ads.txt ile aynı (pub-4283080394775837). Reklam yerleşimi
   ve çerez onayı (Google CMP) AdSense panelinden yönetilir; sayfaya
   reklam alanı elle eklenmez. İdempotent: kod varsa dosya atlanır. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");

const ANCHOR = `gtag('config', 'G-5BNZXVHQ6Z');
</script>`;
const ADSENSE = `${ANCHOR}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4283080394775837" crossorigin="anonymous"></script>`;

const SKIP_DIRS = new Set(["node_modules", "internal-notes", ".git", ".wrangler", "assets", "docs", "tools", "worker"]);
let changed = 0, missing = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); continue; }
    if (!e.name.endsWith(".html") || /^google[0-9a-f]+\.html$/.test(e.name)) continue;
    const file = path.join(dir, e.name);
    let html = fs.readFileSync(file, "utf8");
    if (html.includes("adsbygoogle.js")) continue;
    if (!html.includes(ANCHOR)) { missing++; continue; }
    fs.writeFileSync(file, html.replace(ANCHOR, ADSENSE), "utf8");
    changed++;
  }
}

walk(ROOT);
console.log("AdSense eklenen dosya sayısı:", changed, "| GA snippet'i olmayan (atlandı):", missing);
