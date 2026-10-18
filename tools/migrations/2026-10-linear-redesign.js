/* Linear tarzı yeniden tasarım — tüm HTML'lerde toplu, idempotent düzenleme.

   1) Genel: önbellek sürümleri, theme-color, serif yazı tipinin kaldırılması,
      Google Giriş script'i (Client ID hiç ayarlanmamıştı, çalışmıyordu).
   2) Vakit sayfaları (ana sayfa + 81 il + 973 ilçe): ortak iskelet (hero,
      gövde, footer) yeni düzenle değiştirilir. Sayfaya özgü içerik —
      breadcrumb, H1, tanıtım metni, ilçe listeleri, SSS — AYNEN taşınır.
      Eski iskelet 1055 sayfada birebir aynı olduğu için güvenle değişir;
      beklenen bir parça bulunamazsa sayfa atlanır ve listelenir.
   3) Statik bilgi sayfaları: yeni üst menü + footer, kb-* stilleri artık
      style.css'te (sayfa içi <style> bloklarından çıkarılır).
   4) sehirler / 404 / offline: kendi stillerini taşıyan sayfalar.

   Tekrar çalıştırmak güvenlidir: dönüştürülmüş sayfalara dokunmaz. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");

const SKIP_DIRS = new Set([".git", ".github", ".claude", ".wrangler", "node_modules", "tools", "docs", "internal-notes", "assets"]);

/* ── Ortak parçalar ─────────────────────────────────────────────────── */
const ICO = {
  logo: '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="11" fill="#f7f8f8"/><path d="M7 16.5v-5.2a4 4 0 0 1 8 0v5.2z" fill="#08090a"/></svg>',
  pin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/></svg>',
  chev: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  star: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5Z"/></svg>',
  share: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  bell: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7Z"/><path d="M9.5 18a2.5 2.5 0 0 0 5 0"/></svg>',
  left: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  print: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
  kaaba: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1.5"/></svg>',
};

const NAV_LINKS = [
  ["/sehirler", "Şehirler"],
  ["/kible-yonu-bulma", "Kıble"],
  ["/hicri-takvim", "Hicri Takvim"],
  ["/kaza-namazi-hesaplama", "Kaza Hesabı"],
  ["/namaz-vakitleri-nasil-hesaplanir", "Nasıl Hesaplanır?"],
];

function nav(current, right) {
  const links = NAV_LINKS.map(([href, label]) =>
    `<a href="${href}"${href === current ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  return `<header class="lx-nav">
  <div class="lx-c lx-nav-in">
    <a class="lx-logo" href="/" aria-label="Namaz Vakti — ana sayfa">${ICO.logo}<span>Namaz Vakti</span></a>
    <nav class="lx-links" aria-label="Site">${links}</nav>
    <div class="lx-nav-r">
      ${right}
    </div>
  </div>
</header>`;
}
const NAV_APP = nav(null,
  `<span class="lx-navcd" id="navCd" aria-hidden="true"></span>
      <span class="lx-wx" id="nvWxTile" hidden></span>
      <button class="lx-btn lx-btn--light" id="locBtn" type="button" title="Konumdan il seç">${ICO.pin}<span>Konumum</span></button>`);
const navStatic = (current) => nav(current, `<a class="lx-btn lx-btn--light" href="/">Namaz Vakitleri</a>`);

const FOOTER = `<footer class="lx-foot">
  <div class="lx-c">
    <div class="lx-foot-grid">
      <div class="lx-foot-brand">
        <a class="lx-logo" href="/">${ICO.logo}<span>Namaz Vakti</span></a>
        <p>Türkiye'nin 81 ili ve 973 ilçesi için Diyanet İşleri Başkanlığı kaynaklı güncel namaz vakitleri.</p>
      </div>
      <div>
        <h4>Araçlar</h4>
        <ul>
          <li><a href="/sehirler">Tüm Şehirler</a></li>
          <li><a href="/kible-yonu-bulma">Kıble Yönü Bulma</a></li>
          <li><a href="/hicri-takvim">Hicri Takvim</a></li>
          <li><a href="/kaza-namazi-hesaplama">Kaza Namazı Hesaplama</a></li>
          <li><a href="/namaz-vakitleri-nasil-hesaplanir">Vakitler Nasıl Hesaplanır?</a></li>
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
    <div class="lx-foot-bottom"><span>© 2026 namazvakiti.net</span><span>Veriler Diyanet İşleri Başkanlığı kaynaklıdır.</span></div>
  </div>
</footer>`;

/* ── Yardımcılar ────────────────────────────────────────────────────── */
/* start konumundaki <div ...>'in kapanışından SONRAKİ indeks */
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
const stripStyles = (h) => h.replace(/\s+style="[^"]*"/g, "");

/* ── Vakit sayfası iskeleti ─────────────────────────────────────────── */
function appBody({ crumb, h1, place, dua, seo, faq }) {
  return `${NAV_APP}

<main id="main">
  <section class="lx-hero">
    <div class="lx-c">
      ${crumb}
      <h1 class="lx-eyebrow">${h1}</h1>
      <p class="lx-title"><span class="lx-place" id="heroLoc">${place}</span><span class="lx-cdline"><span id="cdLabel">Namaz vakitleri</span> <span class="lx-cd" id="cdTime"></span></span></p>
      <p class="lx-sub" id="cdSub">Diyanet İşleri Başkanlığı verisiyle güncel imsak, güneş, öğle, ikindi, akşam ve yatsı vakitleri.</p>
      <div class="lx-ctl">
        <div class="sel-wrap"><select id="citySel" aria-label="İl seç"></select><span class="sel-arrow">${ICO.chev}</span></div>
        <div class="sel-wrap"><select id="distSel" aria-label="İlçe seç"></select><span class="sel-arrow">${ICO.chev}</span></div>
        <button class="lx-btn lx-icon-btn" id="favToggleBtn" type="button" aria-label="Favorilere ekle" title="Favorilere ekle">${ICO.star}</button>
        <span class="lx-ctl-sep" aria-hidden="true"></span>
        <button class="lx-btn" id="shareBtn" type="button" aria-label="Namaz vakitlerini paylaş">${ICO.share}<span>Paylaş</span></button>
        <button class="lx-btn" id="notifBtn" type="button">${ICO.bell}<span>Ezan bildirimi</span></button>
      </div>
    </div>
  </section>

  <section class="lx-board" aria-label="Günün vakitleri">
    <div class="lx-c">
      <div id="errBox"></div>
      <div id="noteBox"></div>
      <div class="lx-frame">
        <div class="lx-frame-top">
          <div class="lx-daynav" id="dayNav">
            <button class="day-nav-btn" id="dayPrev" type="button" aria-label="Önceki gün">${ICO.left}</button>
            <div class="day-nav-label"><span id="dayLabel">Bugün</span><button class="day-nav-reset" id="dayReset" type="button" hidden>Bugüne dön</button></div>
            <button class="day-nav-btn" id="dayNext" type="button" aria-label="Sonraki gün">${ICO.right}</button>
          </div>
          <div class="lx-frame-meta"><span id="heroFriday" class="friday-badge" hidden>Cuma</span><span id="heroHijri"></span></div>
        </div>
        <div class="lx-times" id="prayerGrid"></div>
      </div>
    </div>
  </section>

  <section class="lx-sec lx-cal" id="imsakiye">
    <div class="lx-c">
      <div class="lx-sh">
        <div>
          <div class="lx-kicker lx-kicker--indigo">İmsakiye<span id="calMonth"></span></div>
          <h2 class="lx-h2">Aylık vakitler</h2>
          <p class="lx-desc">Önümüzdeki 30 güne kadar Diyanet vakitleri. Bugün vurgulu; yazdırıp imsakiye olarak kullanabilirsiniz.</p>
        </div>
        <div class="lx-sh-actions"><button class="lx-btn" id="calPrintBtn" type="button">${ICO.print}<span>Yazdır</span></button></div>
      </div>
      <div class="lx-table">
        <div class="nv-print-title" id="calPrintTitle"></div>
        <div class="cal-head"><span>Tarih</span><span>İmsak</span><span>Güneş</span><span>Öğle</span><span>İkindi</span><span>Akşam</span><span>Yatsı</span></div>
        <div id="calBody"></div>
      </div>
    </div>
  </section>

  <section class="lx-sec">
    <div class="lx-c">
      <div class="lx-sh">
        <div>
          <div class="lx-kicker lx-kicker--green">Konum</div>
          <h2 class="lx-h2">Kıble ve camiler <span class="dim">bulunduğunuz yere göre.</span></h2>
        </div>
      </div>
      <div class="lx-split">
        <article class="lx-feat">
          <div class="lx-feat-h">
            <h3 class="lx-h3">Kıble yönü</h3>
            <p class="lx-desc">Kâbe'nin yönü konumunuzdan hesaplanır; telefonda pusula canlı döner.</p>
          </div>
          <div class="lx-feat-b">
            <div id="qiblaWidget" class="qibla-widget">
              <div class="qibla-compass">
                <div class="qibla-ring">
                  <div class="qibla-n">K</div>
                  <div class="qibla-needle" id="qiblaNeedle"><div class="qibla-kaaba">${ICO.kaaba}</div></div>
                </div>
              </div>
              <div class="qibla-info">
                <div class="qibla-deg" id="qiblaDeg">—°</div>
                <div class="qibla-hint" id="qiblaHint">Kıble yönünü hesaplamak için konum izni gerekir.</div>
                <button class="qibla-btn" id="qiblaPermBtn" type="button">${ICO.pin} Kıbleyi bul</button>
              </div>
            </div>
          </div>
        </article>
        <article class="lx-feat">
          <div class="lx-feat-h">
            <div class="lx-feat-h-row"><h3 class="lx-h3">Yakındaki camiler</h3><button class="lx-link" id="mosqueMapLink" type="button">Haritada aç ↗</button></div>
            <p class="lx-desc">2,5 km içindeki camiler, yürüme süresiyle birlikte.</p>
          </div>
          <div class="lx-feat-b">
            <div class="mosques" id="mosqueList">
              <div class="mosque-empty">Konum izni verdiğinizde en yakın camiler burada listelenir.<button class="lx-btn lx-btn--light" type="button" data-locate>${ICO.pin}<span>Konumumu kullan</span></button></div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>

  <section class="lx-sec lx-verse" id="verseSec" aria-label="Günün ayeti">
    <div class="lx-c">
      <div class="lx-kicker">Günün ayeti</div>
      <div id="nvVerse"></div>
    </div>
  </section>

  <section class="lx-sec">
    <div class="lx-c">
      <div class="lx-three">
        <div class="lx-cell">
          <div class="lx-kicker lx-kicker--peach">Ramazan</div>
          <h3 class="lx-h3">Ramazan sayacı</h3>
          <div class="nv-ram" id="nvRamadan"></div>
          <div id="ramadanBanner" class="ramadan-banner" hidden>
            <div>
              <div class="ram-title">Ramazan ayındasınız</div>
              <div class="ram-sub"><span id="ramSahur"></span> sahur sonu (imsak) · <span id="ramIftar"></span> iftar (akşam)</div>
            </div>
          </div>
        </div>
        <div class="lx-cell">
          <div class="lx-kicker lx-kicker--peach">Favoriler</div>
          <h3 class="lx-h3">Kayıtlı konumlar</h3>
          <div class="fav-list" id="favList"></div>
        </div>
        <div class="lx-cell">
          <div class="lx-kicker">Bu ay</div>
          <h3 class="lx-h3">İmsak–yatsı aralığı</h3>
          <div id="nvTrend"></div>
        </div>
      </div>
    </div>
  </section>

  <section class="lx-sec">
    <div class="lx-c">
      <div class="lx-sh">
        <div>
          <div class="lx-kicker">Dua</div>
          <h2 class="lx-h2">Dua vakitleri <span class="dim">duaların makbul olduğu anlar.</span></h2>
        </div>
      </div>
      ${dua}
    </div>
  </section>
${seo ? `
  <section class="lx-sec lx-seo">
    <div class="lx-c">
      ${seo}
    </div>
  </section>
` : ""}
  <section class="lx-sec">
    <div class="lx-c lx-faq-grid">
      <div>
        <div class="lx-kicker">SSS</div>
        <h2 class="lx-h2">Sık sorulan sorular</h2>
        <p class="lx-desc">Aradığınızı bulamadınız mı? <a class="lx-link" href="/iletisim">Bize yazın →</a></p>
      </div>
      ${faq}
    </div>
  </section>
</main>

${FOOTER}

<div class="toast" id="toast"></div>
<script src="/app.js?v=14"></script>
</body>
</html>
`;
}

function convertAppPage(s) {
  const bodyOpen = s.indexOf("<body");
  const bodyOpenEnd = s.indexOf(">", bodyOpen) + 1;
  const bodyTag = s.slice(bodyOpen, bodyOpenEnd);
  const heroStart = s.indexOf('<div class="hero" id="hero">');
  const padStart = s.indexOf('<div class="body-pad">');
  if (heroStart < 0 || padStart < 0) throw new Error("hero/body-pad yok");
  const heroEnd = divEnd(s, heroStart);
  const between = s.slice(heroEnd, padStart);

  const crumbM = between.match(/<nav[^>]*aria-label="breadcrumb"[^>]*>([\s\S]*?)<\/nav>/);
  const crumb = crumbM ? `<nav class="lx-crumb" aria-label="breadcrumb">${stripStyles(crumbM[1])}</nav>` : "";
  const h1M = between.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!h1M) throw new Error("h1 yok");

  const padEnd = divEnd(s, padStart);
  const pad = s.slice(padStart, padEnd);
  const duaStart = pad.indexOf('<div class="dua-grid">');
  if (duaStart < 0) throw new Error("dua-grid yok");
  const duaEnd = divEnd(pad, duaStart);
  const faqStart = pad.indexOf('<div class="faq-wrap" id="faqWrap">');
  if (faqStart < 0) throw new Error("faq-wrap yok");
  const faqEnd = divEnd(pad, faqStart);
  const faqHead = pad.lastIndexOf('<div class="sec-head">', faqStart);
  if (faqHead < duaEnd) throw new Error("SSS başlığı bulunamadı");
  const after = pad.slice(faqEnd, pad.length - "</div>".length).trim();
  if (after) throw new Error("SSS sonrası beklenmeyen içerik");

  const seo = stripStyles(pad.slice(duaEnd, faqHead).trim()).replace(/\n {4}/g, "\n      ")
    .replace(/<p>/g, '<p class="lx-intro">');
  const place = (bodyTag.match(/data-district="([^"]*)"/) || bodyTag.match(/data-city="([^"]*)"/) || [, "Türkiye"])[1];

  let head = s.slice(0, bodyOpenEnd);
  head = head.replace(/<script src="https:\/\/accounts\.google\.com\/gsi\/client" async defer><\/script>\n?/, "");
  return head + "\n" + appBody({
    crumb,
    h1: h1M[1].trim(),
    place,
    dua: pad.slice(duaStart, duaEnd),
    seo,
    faq: pad.slice(faqStart, faqEnd),
  });
}

/* ── Statik bilgi sayfaları ─────────────────────────────────────────── */
const STATIC_CURRENT = {
  "kible-yonu-bulma.html": "/kible-yonu-bulma",
  "hicri-takvim.html": "/hicri-takvim",
  "kaza-namazi-hesaplama.html": "/kaza-namazi-hesaplama",
  "namaz-vakitleri-nasil-hesaplanir.html": "/namaz-vakitleri-nasil-hesaplanir",
};
function convertStaticPage(s, rel) {
  s = s.replace(/<header class="nv-header"[\s\S]*?<\/header>/, navStatic(STATIC_CURRENT[rel] || null));
  s = s.replace(/<footer>[\s\S]*?<\/footer>/, FOOTER);
  /* kb-* görünümü artık style.css'te — sayfa içi tekrarları kaldır */
  s = s.replace(/<style>([\s\S]*?)<\/style>/, (m, css) =>
    "<style>" + css.split("\n").filter((l) => !/^\s*\.kb-[^{]*\{.*\}\s*$/.test(l)).join("\n") + "</style>");
  return s;
}

function convertSehirler(s) {
  s = s.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="/assets/style.css?v=13"/>');
  s = s.replace('<div class="wrap">', navStatic("/sehirler") + '\n<main class="kb-wrap kb-wrap--wide">');
  s = s.replace('<nav class="crumb"', '<nav class="kb-crumb"');
  s = s.replace("<h1>", '<h1 class="kb-h1">');
  s = s.replace('<p class="sub">', '<p class="kb-intro">');
  s = s.replace(/\s*<footer>[\s\S]*?<\/footer>\s*<\/div>/, "\n</main>\n" + FOOTER);
  return s;
}

/* ── 404 / offline: kendi kendine yeten sayfalar ───────────────────── */
const FONT_FACE =
  '@font-face{font-family:"Inter Variable";font-style:normal;font-display:swap;font-weight:100 900;src:url(/assets/fonts/inter-latin-ext-wght-normal.woff2) format("woff2-variations");unicode-range:U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;}\n' +
  '  @font-face{font-family:"Inter Variable";font-style:normal;font-display:swap;font-weight:100 900;src:url(/assets/fonts/inter-latin-wght-normal.woff2) format("woff2-variations");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}';
const FONT = '"Inter Variable",-apple-system,system-ui,"Segoe UI",Roboto,sans-serif';
const STANDALONE = {
  "404.html": `<style>
  ${FONT_FACE}
  body{background:#08090a;color:#f7f8f8;font-family:${FONT};-webkit-font-smoothing:antialiased;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;text-align:center;padding:20px;}
  h1{font-size:96px;font-weight:540;letter-spacing:-.05em;line-height:1;margin:0 0 16px;}
  p{color:#8a8f98;margin:0 0 32px;font-size:16px;}
  a{color:#d0d6e0;text-decoration:none;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);height:36px;padding:0 16px;border-radius:999px;display:inline-flex;align-items:center;margin:4px;font-size:13.5px;font-weight:500;transition:background .15s,color .15s;}
  a:first-of-type{background:#e6e6e7;border-color:transparent;color:#08090a;}
  a:hover{background:rgba(255,255,255,.08);color:#f7f8f8;}
  a:first-of-type:hover{background:#fff;color:#08090a;}
</style>`,
  "offline.html": `<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
    background:#08090a;color:#f7f8f8;font-family:${FONT};-webkit-font-smoothing:antialiased;text-align:center;padding:24px;}
  .logo{font-size:52px}
  h1{font-size:24px;font-weight:590;letter-spacing:-.02em}
  p{color:#8a8f98;font-size:15px;line-height:1.6;max-width:320px}
  button{margin-top:8px;height:36px;padding:0 18px;border-radius:999px;border:none;cursor:pointer;
    background:#e6e6e7;color:#08090a;font-family:inherit;font-size:13.5px;font-weight:550;transition:background .15s;}
  button:hover{background:#fff}
</style>`,
};

/* ── Genel metin değişiklikleri ────────────────────────────────────── */
const REPLACEMENTS = [
  ["/assets/style.css?v=12", "/assets/style.css?v=13"],
  ["/app.js?v=13", "/app.js?v=14"],
  ['<meta name="theme-color" content="#1a1426"/>', '<meta name="theme-color" content="#08090a"/>'],
  ['font-family:Georgia,"Times New Roman",serif;', ""],
  ["font-family:Georgia,serif;", ""],
  ['<a href="/">🏠 Ana Sayfa</a>', '<a href="/">Ana Sayfa</a>'],
  ['<a href="/sehirler">🗺 Tüm Şehirler</a>', '<a href="/sehirler">Tüm Şehirler</a>'],
];

let changed = 0;
const failed = [];
function fix(file) {
  const rel = path.relative(ROOT, file);
  let html = fs.readFileSync(file, "utf8");
  const before = html;
  for (const [a, b] of REPLACEMENTS) html = html.split(a).join(b);
  try {
    if (html.includes('<div class="hero" id="hero">')) html = convertAppPage(html);
    else if (html.includes('<header class="nv-header"')) html = convertStaticPage(html, rel);
    else if (rel === "sehirler.html" && !html.includes("lx-nav")) html = convertSehirler(html);
    else if (STANDALONE[rel] && !html.includes("font-size:96px") && !html.includes("height:36px;padding:0 18px")) {
      html = html.replace(/<style>[\s\S]*?<\/style>/, STANDALONE[rel]);
    }
    /* Önceki bir çalıştırmada sınıfsız kalmış tanıtım paragrafları */
    html = html.replace(/(<section class="lx-sec lx-seo">[\s\S]*?<\/section>)/, (m) => m.replace(/<p>/g, '<p class="lx-intro">'));
  } catch (e) {
    failed.push(rel + ": " + e.message);
    return;
  }
  if (html !== before) { fs.writeFileSync(file, html, "utf8"); changed++; }
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); }
    else if (e.name.endsWith(".html")) fix(path.join(dir, e.name));
  }
}
walk(ROOT);
console.log("Toplam güncellenen dosya:", changed);
if (failed.length) { console.log("ATLANAN (" + failed.length + "):\n  " + failed.join("\n  ")); process.exitCode = 1; }
