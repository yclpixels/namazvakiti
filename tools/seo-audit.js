/* SEO denetimi — tüm yayınlanan HTML sayfalarını tarar ve sorunları listeler.
   Kullanım: node tools/seo-audit.js        (sorun varsa çıkış kodu 1)
   Kontroller: title/description var mı, uzunluk, tekrar; tek H1; canonical
   sayfanın kendi adresi mi; og:title/description/image; JSON-LD geçerli mi.
   Worker'ın canlıda değiştirdiği description burada statik hâliyle denetlenir. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SKIP_DIRS = new Set([".git", ".github", ".claude", ".wrangler", "node_modules", "tools", "docs", "internal-notes", "assets", "worker"]);
const NOINDEX_OK = new Set(["404.html", "offline.html"]);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(d, e.name)); }
    else if (e.name.endsWith(".html") && !/^google[0-9a-f]+\.html$/.test(e.name)) files.push(path.join(d, e.name));
  }
})(ROOT);

const issues = {};
const add = (k, v) => (issues[k] = issues[k] || []).push(v);
const seenT = new Map(), seenD = new Map();
const attr = (h, re) => { const m = h.match(re); return m ? m[1] : null; };

/* Dosya yolu → canonical olması gereken adres */
function expectedUrl(rel) {
  if (rel === "index.html") return "https://namazvakiti.net/";
  if (rel.endsWith("/index.html")) return "https://namazvakiti.net/" + rel.slice(0, -"index.html".length);
  return "https://namazvakiti.net/" + rel.replace(/\.html$/, "");
}

for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  const h = fs.readFileSync(f, "utf8");
  if (NOINDEX_OK.has(rel)) continue;
  const title = attr(h, /<title>([^<]*)<\/title>/);
  const desc = attr(h, /<meta name="description" content="([^"]*)"/);
  const canon = attr(h, /<link rel="canonical" href="([^"]*)"/);
  if (!title) add("title yok", rel);
  else {
    if (title.length > 65) add("title > 65 karakter", `${rel} (${title.length})`);
    if (title.length < 25) add("title < 25 karakter", rel);
    seenT.set(title, [...(seenT.get(title) || []), rel]);
  }
  if (!desc) add("description yok", rel);
  else {
    if (desc.length > 160) add("description > 160 karakter", `${rel} (${desc.length})`);
    if (desc.length < 90) add("description < 90 karakter", `${rel} (${desc.length})`);
    seenD.set(desc, [...(seenD.get(desc) || []), rel]);
  }
  if (!canon) add("canonical yok", rel);
  else if (canon !== expectedUrl(rel)) add("canonical sayfanın adresi değil", `${rel} → ${canon}`);
  const h1 = (h.match(/<h1\b/g) || []).length;
  if (h1 !== 1) add(`H1 sayısı ${h1}`, rel);
  for (const p of ["og:title", "og:description", "og:image", "og:url"]) {
    if (!h.includes(`property="${p}"`)) add(`${p} yok`, rel);
  }
  const ogUrl = attr(h, /property="og:url" content="([^"]*)"/);
  if (ogUrl && canon && ogUrl !== canon) add("og:url ≠ canonical", rel);
  if (/name="robots" content="[^"]*noindex/.test(h)) add("noindex", rel);
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { add("bozuk JSON-LD", rel); }
  }
  if (/href="\/[^"]*\.html"/.test(h)) add("iç bağlantıda .html", rel);
}
for (const [t, a] of seenT) if (a.length > 1) add("tekrarlanan title", `${a.length}× "${t}"`);
for (const [d, a] of seenD) if (a.length > 1) add("tekrarlanan description", `${a.length}× ${a.slice(0, 3).join(", ")}`);

console.log(`Denetlenen sayfa: ${files.length}`);
const keys = Object.keys(issues);
if (!keys.length) { console.log("Sorun yok."); process.exit(0); }
for (const k of keys) console.log(`\n${k} (${issues[k].length})\n  ` + issues[k].slice(0, 8).join("\n  "));
process.exitCode = 1;
