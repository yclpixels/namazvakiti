/* FAZ 1G — Google Analytics'i anasayfa + il + ilçe sayfalarına ekle.
   ID değiştirilmedi (G-5BNZXVHQ6Z) — 4 statik sayfada (hakkimizda,
   iletisim, gizlilik, kullanim) zaten birebir aynı kod var; burada
   AYNI (tek, tutarlı) snippet tüm sayfalara yayılıyor. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const ANCHOR = `<meta charset="utf-8"/>`;
const GA_SNIPPET = `<meta charset="utf-8"/>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-5BNZXVHQ6Z"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-5BNZXVHQ6Z');
</script>`;

let changed = 0;
function fix(file) {
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("googletagmanager.com/gtag/js")) return; // zaten var
  if (!html.includes(ANCHOR)) { console.log("UYARI: charset meta yok ->", file); return; }
  html = html.replace(ANCHOR, GA_SNIPPET);
  fs.writeFileSync(file, html, "utf8");
  changed++;
}

fix(path.join(ROOT, "index.html"));
// "sehirler.html" (Tüm Şehirler hub sayfası) da önemli bir public sayfa —
// GA henüz yoktu, ekleniyor. namaz-vakitleri-nasil-hesaplanir.html'de zaten
// mevcut olduğu için fix() onu otomatik atlayacak.
fix(path.join(ROOT, "sehirler.html"));
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
console.log("GA eklenen dosya sayısı:", changed);
