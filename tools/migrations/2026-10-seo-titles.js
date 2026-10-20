/* Arama sonucu başlıkları — idempotent.
   - İl: "X Ezan Vakitleri 2026 | Güncel Namaz Saatleri" → asıl aranan ifade
     "namaz vakitleri" başa: "X Namaz Vakitleri 2026 | Ezan Saatleri ve İmsakiye"
   - İlçe: il adı her başlıkta: "Kadıköy (İstanbul) Namaz Vakitleri 2026 | Ezan Saatleri"
     ("il ilçe namaz vakti" aramalarıyla eşleşir; ~60 karakter sınırına sığar)
   - Araç sayfaları: soru/niyet içeren, marka sonda başlıklar
   <title>, og:title ve twitter:title birlikte güncellenir; H1 ve description'a dokunulmaz. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const dataset = require("../data/turkey-il-ilce.json");

const TOOL_TITLES = {
  "kible-yonu-bulma.html": "Kıble Yönü Bulma – Online Kıble Pusulası | namazvakiti.net",
  "hicri-takvim.html": "Hicri Takvim – Bugün Hicri Tarih Kaç? | namazvakiti.net",
  "kaza-namazi-hesaplama.html": "Kaza Namazı Hesaplama – Kaç Vakit Kazam Var? | namazvakiti.net",
  "namaz-vakitleri-nasil-hesaplanir.html": "Namaz Vakitleri Nasıl Hesaplanır? İmsak'tan Yatsıya Kriterler",
  "sehirler.html": "81 İl Namaz Vakitleri – Tüm Şehirler ve İlçeler | namazvakiti.net",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function retitle(rel, next) {
  const file = path.join(ROOT, rel);
  const html = fs.readFileSync(file, "utf8");
  const cur = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  if (!cur || cur === next) return 0;
  const out = html
    .replace(`<title>${cur}</title>`, `<title>${esc(next)}</title>`)
    .replace(`<meta property="og:title" content="${cur}"/>`, `<meta property="og:title" content="${esc(next)}"/>`)
    .replace(`<meta name="twitter:title" content="${cur}"/>`, `<meta name="twitter:title" content="${esc(next)}"/>`);
  fs.writeFileSync(file, out, "utf8");
  return 1;
}

let changed = 0;
for (const p of dataset.provinces) {
  changed += retitle(`${p.slug}.html`, `${p.name} Namaz Vakitleri 2026 | Ezan Saatleri ve İmsakiye`);
  for (const d of p.districts) {
    const rel = `${p.slug}/${d.slug}/index.html`;
    if (fs.existsSync(path.join(ROOT, rel))) changed += retitle(rel, `${d.name} (${p.name}) Namaz Vakitleri 2026 | Ezan Saatleri`);
  }
}
for (const [rel, t] of Object.entries(TOOL_TITLES)) changed += retitle(rel, t);

console.log("Başlığı güncellenen sayfa:", changed);
