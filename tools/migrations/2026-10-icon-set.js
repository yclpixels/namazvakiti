/* Renkli ikon seti (assets/icons/nv/*.webp) — idempotent.
   - Dua kartlarındaki çizgi SVG'ler → renkli ikon
   - Kıble / camiler / Ramazan / favoriler / aylık bölüm başlıklarına ikon
   - Mobil menüdeki "Araçlar" bağlantılarına ikon
   - İl, ilçe ve ana sayfaya "Araçlar" kart bölümü (#araclar): araç
     sayfalarına sitenin her yerinden iç bağlantı
   - Araç sayfalarının H1'ine ikon
   - Önbellek sürümleri: style.css v15, app.js v16 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const SKIP_DIRS = new Set([".git", ".github", ".claude", ".wrangler", "node_modules", "tools", "docs", "internal-notes", "assets"]);

const ICO = (name, mod = "", lazy = true) =>
  `<span class="nv-ico${mod ? " nv-ico--" + mod : ""}"><img src="/assets/icons/nv/${name}.webp" width="32" height="32" alt=""${lazy ? ' loading="lazy"' : ""} decoding="async"/></span>`;

const DUA_ICONS = { "Seher Vakti": "tesbih", "Ezan Okunurken": "ezan", "Cuma Günü İcabet Saati": "cami", "İftar Vakti": "aksam" };
const HEAD_ICONS = [
  ['<h3 class="lx-h3">Kıble yönü</h3>', "kabe"],
  ['<h3 class="lx-h3">Yakındaki camiler</h3>', "cami"],
  ['<h3 class="lx-h3">Ramazan sayacı</h3>', "hicri"],
  ['<h3 class="lx-h3">Kayıtlı konumlar</h3>', "favori"],
  ['<h3 class="lx-h3">İmsak–yatsı aralığı</h3>', "gunes"],
];
const MENU_ICONS = {
  "/": "cami", "/sehirler": "konum", "/kible-yonu-bulma": "pusula", "/hicri-takvim": "hicri",
  "/kaza-namazi-hesaplama": "secde", "/namaz-vakitleri-nasil-hesaplanir": "ogle",
};
const TOOL_H1 = {
  "kible-yonu-bulma.html": "pusula", "hicri-takvim.html": "hicri", "kaza-namazi-hesaplama.html": "secde",
  "namaz-vakitleri-nasil-hesaplanir.html": "ogle", "sehirler.html": "konum",
};

const toolsSection = (place) => `<section class="lx-sec" id="araclar">
    <div class="lx-c">
      <div class="lx-sh">
        <div>
          <div class="lx-kicker">Araçlar</div>
          <h2 class="lx-h2">Namaz rehberi <span class="dim">vakitlerin ötesinde.</span></h2>
        </div>
      </div>
      <div class="nv-tools">
        <a class="nv-tool" href="#imsakiye">${ICO("takvim", "lg")}<span><b>${place ? place + " imsakiyesi" : "Aylık imsakiye"}</b><span>30 günlük vakit tablosu, yazdırılabilir</span></span></a>
        <a class="nv-tool" href="/kible-yonu-bulma">${ICO("pusula", "lg")}<span><b>Kıble yönü bulma</b><span>Canlı pusula ile Kâbe'nin yönü</span></span></a>
        <a class="nv-tool" href="/hicri-takvim">${ICO("hicri", "lg")}<span><b>Hicri takvim</b><span>Bugünün hicri tarihi ve ay tablosu</span></span></a>
        <a class="nv-tool" href="/kaza-namazi-hesaplama">${ICO("secde", "lg")}<span><b>Kaza namazı hesaplama</b><span>Kılınmayan namaz sayısını bulun</span></span></a>
        <a class="nv-tool" href="/namaz-vakitleri-nasil-hesaplanir">${ICO("ogle", "lg")}<span><b>Vakitler nasıl hesaplanır?</b><span>İmsaktan yatsıya astronomik kriterler</span></span></a>
        <a class="nv-tool" href="/sehirler">${ICO("konum", "lg")}<span><b>81 il namaz vakitleri</b><span>Tüm şehir ve ilçe sayfaları</span></span></a>
      </div>
    </div>
  </section>

  `;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.name.endsWith(".html") && !e.name.startsWith("google")) out.push(path.join(dir, e.name));
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT, [])) {
  const rel = path.relative(ROOT, file);
  const orig = fs.readFileSync(file, "utf8");
  let h = orig;

  // Dua kartları
  h = h.replace(/<div class="dua-ico"><svg[\s\S]*?<\/svg><\/div>(\s*<div class="dua-name">([^<]+)<\/div>)/g,
    (m, tail, name) => DUA_ICONS[name] ? `<div class="dua-ico">${ICO(DUA_ICONS[name], "lg")}</div>${tail}` : m);

  // Bölüm başlıkları
  for (const [tag, name] of HEAD_ICONS) {
    h = h.split(tag).join(tag.replace('<h3 class="lx-h3">', `<h3 class="lx-h3 nv-h">${ICO(name)}`));
  }
  h = h.replace('<h2 class="lx-h2">Aylık vakitler</h2>', `<h2 class="lx-h2 nv-h">${ICO("takvim", "lg")}Aylık vakitler</h2>`);

  // Mobil menü: yalnızca menü panelindeki ilk liste (footer'daki aynı bağlantılara dokunma)
  h = h.replace(/(<div class="lx-menu-panel">[\s\S]*?<ul>)([\s\S]*?)(<\/ul>)/, (m, a, list, c) =>
    a + list.replace(/<li><a href="([^"]+)">(?!<span class="nv-ico)/g, (mm, href) =>
      MENU_ICONS[href] ? `<li><a href="${href}">${ICO(MENU_ICONS[href], "sm")}` : mm) + c);

  // Araçlar bölümü (vakit tablosu olan sayfalar: ana sayfa, il, ilçe)
  if (!h.includes('id="araclar"')) {
    const place = (h.match(/<body[^>]*data-district="([^"]+)"/) || h.match(/<body[^>]*data-city="([^"]+)"/) || [])[1];
    h = h.replace(/<section class="lx-sec">(\s*<div class="lx-c lx-faq-grid">)/, (m) => toolsSection(place) + m);
  }

  // Araç sayfalarının H1'i
  if (TOOL_H1[rel]) {
    h = h.replace(/<h1 class="kb-h1">/, `<h1 class="kb-h1 nv-h">${ICO(TOOL_H1[rel], "xl", false)}`);
  }

  h = h.split("/assets/style.css?v=14").join("/assets/style.css?v=15").split("/app.js?v=15").join("/app.js?v=16");

  if (h !== orig) { fs.writeFileSync(file, h, "utf8"); changed++; }
}

const swPath = path.join(ROOT, "sw.js");
let sw = fs.readFileSync(swPath, "utf8");
const sw2 = sw.replace('"namaz-v5"', '"namaz-v6"').replace("/app.js?v=15", "/app.js?v=16").replace("/assets/style.css?v=14", "/assets/style.css?v=15");
if (sw2 !== sw) fs.writeFileSync(swPath, sw2, "utf8");

console.log("Güncellenen HTML:", changed);
