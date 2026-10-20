/* Site geneli iç bağlantılar — idempotent.
   - Zikirmatik: mobil menü (ikonlu) ve footer "Araçlar" listesine; Araçlar
     kartlarında "Vakitler nasıl hesaplanır?" yerine (o sayfa menü/footer'da kalıyor)
   - Footer'a "Popüler şehirler" sütunu: büyük illere her sayfadan bağlantı
     (masaüstünde mobil menü gizli olduğu için bu bağlantılar yalnızca ana sayfadaydı)
   - İlçe sayfalarındaki "Diğer X İlçeleri": herkes alfabetik ilk 8 ilçeye bağlanıyordu;
     artık her ilçe kendisinden sonraki 8 ilçeye (döngüsel) bağlanır — her ilçe
     kardeşlerinden eşit sayıda bağlantı alır
   - Ana sayfa WebSite şeması: alternateName + inLanguage (Google site adı) */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const SKIP_DIRS = new Set([".git", ".github", ".claude", ".wrangler", "node_modules", "tools", "docs", "internal-notes", "assets", "worker"]);
const dataset = require("../data/turkey-il-ilce.json");

const ICO = (name, mod) => `<span class="nv-ico nv-ico--${mod}"><img src="/assets/icons/nv/${name}.webp" width="32" height="32" alt="" loading="lazy" decoding="async"/></span>`;
const KAZA_MENU = `<li><a href="/kaza-namazi-hesaplama">${ICO("secde", "sm")}Kaza Namazı Hesaplama</a></li>`;
const ZIKIR_MENU = `\n              <li><a href="/zikirmatik">${ICO("tesbih", "sm")}Zikirmatik</a></li>`;
const KAZA_FOOT = '<li><a href="/kaza-namazi-hesaplama">Kaza Namazı Hesaplama</a></li>';
const ZIKIR_FOOT = '\n          <li><a href="/zikirmatik">Zikirmatik</a></li>';
const NASIL_CARD = /<a class="nv-tool" href="\/namaz-vakitleri-nasil-hesaplanir">[\s\S]*?<\/a>/;
const ZIKIR_CARD = `<a class="nv-tool" href="/zikirmatik">${ICO("tesbih", "lg")}<span><b>Zikirmatik</b><span>Dijital tesbih sayacı, hedef ve tur</span></span></a>`;
const POPULAR = [["istanbul", "İstanbul"], ["ankara", "Ankara"], ["izmir", "İzmir"], ["bursa", "Bursa"], ["antalya", "Antalya"],
  ["konya", "Konya"], ["adana", "Adana"], ["gaziantep", "Gaziantep"], ["kayseri", "Kayseri"], ["sanliurfa", "Şanlıurfa"]];
const FOOT_CITIES = `<div>
        <h4>Popüler şehirler</h4>
        <ul class="lx-foot-cities">
${POPULAR.map(([s, n]) => `          <li><a href="/${s}">${n} namaz vakitleri</a></li>`).join("\n")}
        </ul>
      </div>
      `;

/* ilçe yolu → kendisinden sonraki 8 kardeş (il içinde, tr alfabetik, döngüsel) */
const siblings = new Map();
for (const p of dataset.provinces) {
  const ds = p.districts.filter((d) => fs.existsSync(path.join(ROOT, p.slug, d.slug, "index.html")))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  ds.forEach((d, i) => {
    const pick = [];
    for (let k = 1; k < ds.length && pick.length < 8; k++) pick.push(ds[(i + k) % ds.length]);
    siblings.set(`${p.slug}/${d.slug}/index.html`, { p, pick });
  });
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.name.endsWith(".html") && !e.name.startsWith("google")) out.push(path.join(dir, e.name));
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT, [])) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const orig = fs.readFileSync(file, "utf8");
  let h = orig;

  if (!h.includes('href="/zikirmatik">')) {
    h = h.replace(KAZA_MENU, KAZA_MENU + ZIKIR_MENU);
    const f = h.indexOf('<footer class="lx-foot">');
    if (f >= 0) h = h.slice(0, f) + h.slice(f).replace(KAZA_FOOT, KAZA_FOOT + ZIKIR_FOOT);
  }
  if (!h.includes('href="/zikirmatik"><span class="nv-ico nv-ico--lg">')) h = h.replace(NASIL_CARD, ZIKIR_CARD);

  if (!h.includes("lx-foot-cities")) {
    const f = h.indexOf('<footer class="lx-foot">');
    if (f >= 0) h = h.slice(0, f) + h.slice(f).replace(/<div>\s*<h4>Kurumsal<\/h4>/, (m) => FOOT_CITIES + m);
  }

  const sib = siblings.get(rel);
  if (sib) {
    const links = sib.pick.map((d) => `<a href="/${sib.p.slug}/${d.slug}/">${d.name}</a>`).join("");
    h = h.replace(/(<div class="nv-sibling-districts"><div>[^<]*<\/div>)[\s\S]*?(<a href="\/[^"]+">Tüm [^<]*<\/a><\/div>)/, `$1${links}$2`);
  }

  if (rel === "index.html") {
    h = h.replace('{"@context":"https://schema.org","@type":"WebSite","name":"namazvakiti.net","url":"https://namazvakiti.net/"}',
      '{"@context":"https://schema.org","@type":"WebSite","name":"namazvakiti.net","alternateName":["Namaz Vakti","Namaz Vakitleri"],"url":"https://namazvakiti.net/","inLanguage":"tr-TR"}');
  }

  h = h.split("/assets/style.css?v=15").join("/assets/style.css?v=16");

  if (h !== orig) { fs.writeFileSync(file, h, "utf8"); changed++; }
}

const swPath = path.join(ROOT, "sw.js");
const sw = fs.readFileSync(swPath, "utf8");
const sw2 = sw.replace('"namaz-v6"', '"namaz-v7"').replace("/assets/style.css?v=15", "/assets/style.css?v=16");
if (sw2 !== sw) fs.writeFileSync(swPath, sw2, "utf8");

console.log("Güncellenen HTML:", changed);
