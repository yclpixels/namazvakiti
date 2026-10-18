/* Mobil menü + SEO/erişilebilirlik tamamlamaları — idempotent.
   - Üst menüye tablet/mobilde görünen ☰ menü (<details>, JS gerektirmez)
   - "İçeriğe geç" bağlantısı ve her sayfada <main id="main">
   - Inter font ön yüklemesi (ilk boyamada yazı tipi kayması olmasın)
   - sehirler: paylaşım görseli, manifest, favicon, BreadcrumbList JSON-LD
   - Ana sayfa Organization şemasına logo; uzun açıklamanın kısaltılması
   - 404/offline: favicon
   - Önbellek sürümleri: style.css v14, app.js v15 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const SKIP_DIRS = new Set([".git", ".github", ".claude", ".wrangler", "node_modules", "tools", "docs", "internal-notes", "assets"]);

const ICO_MENU = '<svg class="lx-menu-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
  '<svg class="lx-menu-close" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

const MENU = `<details class="lx-menu">
      <summary class="lx-btn lx-icon-btn" aria-label="Menü">${ICO_MENU}</summary>
      <div class="lx-menu-panel">
        <div class="lx-c lx-menu-grid">
          <div>
            <h4>Araçlar</h4>
            <ul>
              <li><a href="/">Namaz Vakitleri</a></li>
              <li><a href="/sehirler">Tüm Şehirler</a></li>
              <li><a href="/kible-yonu-bulma">Kıble Yönü Bulma</a></li>
              <li><a href="/hicri-takvim">Hicri Takvim</a></li>
              <li><a href="/kaza-namazi-hesaplama">Kaza Namazı Hesaplama</a></li>
              <li><a href="/namaz-vakitleri-nasil-hesaplanir">Vakitler Nasıl Hesaplanır?</a></li>
            </ul>
          </div>
          <div>
            <h4>Popüler şehirler</h4>
            <ul class="lx-menu-cities">
              <li><a href="/istanbul">İstanbul</a></li><li><a href="/ankara">Ankara</a></li><li><a href="/izmir">İzmir</a></li>
              <li><a href="/bursa">Bursa</a></li><li><a href="/antalya">Antalya</a></li><li><a href="/konya">Konya</a></li>
              <li><a href="/adana">Adana</a></li><li><a href="/gaziantep">Gaziantep</a></li><li><a href="/kayseri">Kayseri</a></li>
              <li><a href="/sehirler">Tüm 81 il →</a></li>
            </ul>
          </div>
          <div>
            <h4>Kurumsal</h4>
            <ul>
              <li><a href="/hakkimizda">Hakkımızda</a></li>
              <li><a href="/iletisim">İletişim</a></li>
              <li><a href="/gizlilik">Gizlilik</a></li>
              <li><a href="/kullanim">Kullanım Şartları</a></li>
            </ul>
          </div>
        </div>
      </div>
    </details>`;

const SKIP = '<a class="lx-skip" href="#main">İçeriğe geç</a>';
const PRELOAD = '<link rel="preload" href="/assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin/>';
const FAVICONS = `<link rel="icon" href="/favicon.ico"/>
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32-v2.png"/>`;

function divEnd(s, start) {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(s))) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return re.lastIndex;
  }
  throw new Error("eşleşen </div> yok");
}

const REPLACEMENTS = [
  ["/assets/style.css?v=13", "/assets/style.css?v=14"],
  ["/app.js?v=14", "/app.js?v=15"],
  ['"@type":"Organization","name":"namazvakiti.net","url":"https://namazvakiti.net/"}',
    '"@type":"Organization","name":"namazvakiti.net","url":"https://namazvakiti.net/","logo":"https://namazvakiti.net/assets/icons/icon-512-v2.png"}'],
  ["İmsak, güneş, öğle, ikindi, akşam ve yatsı vakitlerinin hangi astronomik kriterlere göre belirlendiğini ve neden şehirden şehre değiştiğini öğrenin.",
    "İmsak, güneş, öğle, ikindi, akşam ve yatsı hangi astronomik kriterlere göre belirlenir, neden şehirden şehre değişir?"],
];

function fix(file) {
  const rel = path.relative(ROOT, file);
  let h = fs.readFileSync(file, "utf8");
  const before = h;
  for (const [a, b] of REPLACEMENTS) h = h.split(a).join(b);

  if (h.includes('class="lx-nav"')) {
    if (!h.includes('class="lx-menu"')) {
      h = h.replace(/(<div class="lx-nav-r">[\s\S]*?\n    <\/div>)/, `$1\n    ${MENU}`);
      if (!h.includes('class="lx-menu"')) throw new Error(rel + ": menü eklenemedi");
    }
    if (!h.includes('class="lx-skip"')) h = h.replace(/(<body[^>]*>)/, `$1\n${SKIP}`);
    if (!h.includes(PRELOAD)) h = h.replace(/(<link rel="stylesheet" href="\/assets\/style\.css\?v=\d+"\/>)/, `$1\n${PRELOAD}`);
    // Statik sayfalarda içerik kabı <main> olur
    const kb = h.indexOf('<div class="kb-wrap">');
    if (kb >= 0) {
      const end = divEnd(h, kb);
      h = h.slice(0, kb) + '<main class="kb-wrap" id="main">' + h.slice(kb + '<div class="kb-wrap">'.length, end - 6) + "</main>" + h.slice(end);
    }
    h = h.replace('<main class="kb-wrap kb-wrap--wide">', '<main class="kb-wrap kb-wrap--wide" id="main">');
  }

  if (rel === "sehirler.html" && !h.includes('"BreadcrumbList"')) {
    h = h.replace('<meta name="twitter:card" content="summary_large_image"/>',
      '<meta property="og:image" content="https://namazvakiti.net/assets/og-image-v2.png"/>\n<meta name="twitter:card" content="summary_large_image"/>');
    h = h.replace(/(<meta name="twitter:description"[^>]*\/>)/,
      '$1\n<meta name="twitter:image" content="https://namazvakiti.net/assets/og-image-v2.png"/>');
    h = h.replace('<link rel="icon" href="/favicon.ico"/>', FAVICONS + '\n<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon-v2.png"/>\n<link rel="manifest" href="/manifest.webmanifest"/>');
    h = h.replace("</head>", '<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Ana Sayfa","item":"https://namazvakiti.net/"},{"@type":"ListItem","position":2,"name":"Tüm Şehirler","item":"https://namazvakiti.net/sehirler"}]}</script>\n</head>');
  }

  if ((rel === "404.html" || rel === "offline.html") && !h.includes('rel="icon"')) {
    h = h.replace("</title>", "</title>\n" + FAVICONS);
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
