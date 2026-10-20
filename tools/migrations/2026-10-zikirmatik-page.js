/* zikirmatik.html — yeni araç sayfası (dijital tesbih sayacı). Idempotent:
   sayfa zaten varsa dokunmaz. Üst menü, mobil menü ve footer, kaza-namazi-hesaplama
   sayfasından birebir alınır; böylece site geneli şablonla aynı kalır. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "zikirmatik.html");
if (fs.existsSync(OUT)) { console.log("zikirmatik.html zaten var"); process.exit(0); }

const tpl = fs.readFileSync(path.join(ROOT, "kaza-namazi-hesaplama.html"), "utf8");
const between = (a, b) => { const i = tpl.indexOf(a); const j = tpl.indexOf(b, i); if (i < 0 || j < 0) throw new Error("şablon parçası yok: " + a); return tpl.slice(i, j); };

const TITLE = "Zikirmatik – Online Dijital Tesbih Sayacı | namazvakiti.net";
const DESC = "Ücretsiz online zikirmatik: dokun ve say. 33, 99, 100 veya kendi hedefiniz, tur sayacı, titreşim ve zikir başına ayrı kayıt. Uygulama indirmeden telefonda çalışır.";
const URL = "https://namazvakiti.net/zikirmatik";

const FAQ = [
  ["Zikirmatik nedir?", "Zikirmatik, tesbih çekerken sayıyı elle tutmak yerine her dokunuşta bir artan dijital bir sayaçtır. Bu sayfa tarayıcıda çalışır; uygulama indirmeniz gerekmez."],
  ["Sayaç kaydediliyor mu?", "Evet. Her zikrin sayısı ve tur adedi yalnızca kendi tarayıcınızda saklanır; sayfayı kapatıp açtığınızda kaldığınız yerden devam edersiniz. Hiçbir veri sunucuya gönderilmez."],
  ["Hedefe ulaşınca ne olur?", "Seçtiğiniz hedefe (33, 99, 100, 500 veya 1000) ulaşıldığında telefon destekliyorsa kısa bir titreşim verilir, tur sayısı bir artar ve sayaç sıfırdan devam eder."],
  ["Klavyeyle kullanılabilir mi?", "Evet. Bilgisayarda boşluk (Space) veya Enter tuşuna her basışınız bir sayılır."],
];
const faqLd = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
const crumbLd = JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
  { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: "https://namazvakiti.net/" },
  { "@type": "ListItem", position: 2, name: "Zikirmatik", item: URL }] });
const appLd = JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "Zikirmatik", url: URL,
  applicationCategory: "LifestyleApplication", operatingSystem: "Web", inLanguage: "tr-TR",
  offers: { "@type": "Offer", price: "0", priceCurrency: "TRY" } });

const headTop = between("<!DOCTYPE html>", "<title>");
const headLinks = between('<meta name="theme-color"', '<script type="application/ld+json">');
const nav = between('<a class="lx-skip"', "<main").replace(' aria-current="page"', "");
const footer = between("  <footer", "<script>\n(function(){");

const html = `${headTop}<title>${TITLE}</title>
<meta name="description" content="${DESC}"/>
<link rel="canonical" href="${URL}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${TITLE}"/>
<meta property="og:description" content="${DESC}"/>
<meta property="og:url" content="${URL}"/>
<meta property="og:image" content="https://namazvakiti.net/assets/og-image-v2.png"/>
<meta property="og:site_name" content="namazvakiti.net"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${TITLE}"/>
<meta name="twitter:description" content="${DESC}"/>
<meta name="twitter:image" content="https://namazvakiti.net/assets/og-image-v2.png"/>
${headLinks}<script type="application/ld+json">${faqLd}</script>
<script type="application/ld+json">${crumbLd}</script>
<script type="application/ld+json">${appLd}</script>
<style>
  .zk{display:flex;flex-direction:column;align-items:center;gap:22px;margin:8px 0 24px;padding:32px 20px;border:1px solid var(--line);border-radius:16px;background:var(--bg-2);}
  .zk-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;}
  .zk-chip{height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.02);color:var(--text-3);
    font:500 13.5px/1 var(--font);cursor:pointer;transition:background .16s,border-color .16s,color .16s;}
  .zk-chip:hover{color:var(--text);border-color:var(--line-3);}
  .zk-chip[aria-pressed="true"]{background:#f3eee3;border-color:#f3eee3;color:#023d2e;font-weight:600;}
  .zk-btn{position:relative;width:min(72vw,280px);aspect-ratio:1;border-radius:50%;border:0;cursor:pointer;touch-action:manipulation;
    -webkit-tap-highlight-color:transparent;user-select:none;background:radial-gradient(circle at 50% 38%,#fbf8f1,#efe8d8 70%);color:#023d2e;
    box-shadow:0 0 0 6px rgba(201,160,80,.18),0 18px 40px rgba(0,0,0,.45),inset 0 -6px 0 rgba(2,61,46,.08);transition:transform .08s;}
  .zk-btn:active{transform:scale(.97);}
  .zk-btn:focus-visible{outline:3px solid var(--indigo-3);outline-offset:6px;}
  .zk-btn svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);}
  .zk-btn circle{fill:none;stroke-width:5;}
  .zk-n{position:relative;display:block;font-size:clamp(56px,16vw,84px);font-weight:600;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums;}
  .zk-of{position:relative;display:block;margin-top:8px;color:#5b6b5f;font-size:14px;font-weight:500;}
  .zk-name{color:var(--text);font-size:20px;font-weight:590;letter-spacing:-.015em;text-align:center;}
  .zk-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 18px;color:var(--text-3);font-size:14px;}
  .zk-meta b{color:var(--text);font-weight:600;font-variant-numeric:tabular-nums;}
  .zk-row{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;}
  .zk-row label{display:inline-flex;align-items:center;gap:8px;color:var(--text-3);font-size:13.5px;}
  .zk-row select{height:34px;padding:0 10px;border-radius:999px;border:1px solid var(--line);background:var(--panel-2);color:var(--text);font:500 13.5px var(--font);}
</style>
</head>
<body>
${nav}<main class="kb-wrap" id="main">
    <nav class="kb-crumb" aria-label="breadcrumb"><a href="/">Ana Sayfa</a> › <span style="color:var(--cream);">Zikirmatik</span></nav>
    <h1 class="kb-h1 nv-h"><span class="nv-ico nv-ico--xl"><img src="/assets/icons/nv/tesbih.webp" width="32" height="32" alt="" decoding="async"/></span>Zikirmatik</h1>
    <p class="kb-intro">Telefonunuzu ya da bilgisayarınızı <b>dijital tesbih</b> olarak kullanın: büyük daireye her dokunuşta sayaç bir artar. Zikri ve hedefi seçin; hedefe ulaşıldığında tur sayısı artar ve sayaç sıfırdan devam eder. Her zikrin sayısı ayrı ayrı, yalnızca kendi tarayıcınızda saklanır.</p>

    <section class="zk" aria-label="Zikir sayacı">
      <div class="zk-chips" id="zkList" role="group" aria-label="Zikir seç"></div>
      <div class="zk-name" id="zkName"></div>
      <button class="zk-btn" id="zkBtn" type="button" aria-describedby="zkOf">
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" stroke="rgba(2,61,46,.10)"/><circle id="zkRing" cx="50" cy="50" r="47" stroke="#c9a050" stroke-linecap="round" stroke-dasharray="295.3" stroke-dashoffset="295.3"/></svg>
        <span class="zk-n" id="zkN" aria-live="polite">0</span><span class="zk-of" id="zkOf"></span>
      </button>
      <div class="zk-meta"><span>Tur: <b id="zkTur">0</b></span><span>Toplam: <b id="zkTotal">0</b></span></div>
      <div class="zk-row">
        <label>Hedef <select id="zkTarget"><option value="33">33</option><option value="99">99</option><option value="100">100</option><option value="500">500</option><option value="1000">1000</option><option value="0">Sınırsız</option></select></label>
        <button class="zk-chip" id="zkVib" type="button" aria-pressed="true">Titreşim</button>
        <button class="zk-chip" id="zkUndo" type="button">−1 Geri al</button>
        <button class="zk-chip" id="zkReset" type="button">Sıfırla</button>
      </div>
    </section>

    <div class="kb-links">
      <a href="/">← Namaz Vakitleri</a>
      <a href="/kible-yonu-bulma">Kıble Yönü Bulma</a>
      <a href="/hicri-takvim">Hicri Takvim</a>
      <a href="/kaza-namazi-hesaplama">Kaza Namazı Hesaplama</a>
    </div>

    <div class="sec-head">
      <h2 class="sec-title serif">Sık Sorulan Sorular</h2>
    </div>
    <div class="faq-wrap">
${FAQ.map(([q, a]) => `      <details class="faq-item">
        <summary>${q}</summary>
        <p>${a}</p>
      </details>`).join("\n")}
    </div>
  </main>

${footer}<script>
(function(){
  "use strict";
  var ZIKIRLER = ["Sübhanallah", "Elhamdülillah", "Allahu Ekber", "Lâ ilâhe illallah", "Estağfirullah", "Salavat", "Serbest zikir"];
  var KEY = "nv_zikir_v1";
  var st;
  try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { st = {}; }
  st.cur = ZIKIRLER.indexOf(st.cur) >= 0 ? st.cur : ZIKIRLER[0];
  st.target = typeof st.target === "number" ? st.target : 33;
  st.vib = st.vib !== false;
  st.c = st.c || {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function rec() { return st.c[st.cur] || (st.c[st.cur] = { n: 0, tur: 0, total: 0 }); }

  var $ = function (id) { return document.getElementById(id); };
  var list = $("zkList"), btn = $("zkBtn"), ring = $("zkRing"), target = $("zkTarget"), vib = $("zkVib");
  var C = 295.3;

  function render() {
    var r = rec();
    list.innerHTML = ZIKIRLER.map(function (z) {
      return '<button class="zk-chip" type="button" data-z="' + z + '" aria-pressed="' + (z === st.cur) + '">' + z + "</button>";
    }).join("");
    $("zkName").textContent = st.cur;
    $("zkN").textContent = r.n;
    $("zkOf").textContent = st.target ? "/ " + st.target : "sınırsız";
    $("zkTur").textContent = r.tur;
    $("zkTotal").textContent = r.total.toLocaleString("tr-TR");
    ring.setAttribute("stroke-dashoffset", st.target ? C * (1 - r.n / st.target) : C);
    target.value = String(st.target);
    vib.setAttribute("aria-pressed", String(st.vib));
  }
  function buzz(ms) {
    // Tarayıcı, sayfaya henüz dokunulmadıysa titreşimi engeller (ve konsola hata yazar)
    var ua = navigator.userActivation;
    if (st.vib && navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(ms);
  }
  function inc() {
    var r = rec();
    r.n++; r.total++;
    if (st.target && r.n >= st.target) { r.n = 0; r.tur++; buzz([60, 60, 120]); } else buzz(12);
    save(); render();
  }

  btn.addEventListener("click", inc);
  document.addEventListener("keydown", function (e) {
    if ((e.code === "Space" || e.key === "Enter") && !/^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY|A)$/.test(e.target.tagName)) { e.preventDefault(); inc(); }
  });
  list.addEventListener("click", function (e) {
    var b = e.target.closest("[data-z]"); if (!b) return;
    st.cur = b.dataset.z; save(); render();
  });
  target.addEventListener("change", function () {
    st.target = parseInt(target.value, 10) || 0;
    var r = rec(); if (st.target && r.n >= st.target) r.n = 0;
    save(); render();
  });
  vib.addEventListener("click", function () { st.vib = !st.vib; save(); render(); });
  $("zkUndo").addEventListener("click", function () {
    var r = rec(); if (r.n > 0) { r.n--; r.total = Math.max(0, r.total - 1); save(); render(); }
  });
  $("zkReset").addEventListener("click", function () {
    if (!confirm(st.cur + " sayacı sıfırlansın mı?")) return;
    st.c[st.cur] = { n: 0, tur: 0, total: 0 }; save(); render();
  });
  render();
})();
</script>
</body>
</html>
`;
fs.writeFileSync(OUT, html, "utf8");
console.log("zikirmatik.html oluşturuldu");
