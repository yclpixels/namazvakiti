/* FAZ 2 — quality-gate'de bulunan iki sorunun düzeltmesi:
   1) data-city attribute'u bazı illerde (29/81) Türkçe karaktersiz
      yazılmış (örn. "Mugla" değil "Muğla" olmalı). app.js normTR()
      ile zaten diacritic-insensitive eşleştirdiği için bu FONKSİYONEL
      bir hata değildi, ama veri tutarlılığı için düzeltiliyor.
   2) 25 grup ilçe adı (en başta "Merkez" — 51 ilde resmi ilçe adı —
      ve ~9 farklı-ilde-aynı-isim çakışması) birebir aynı <title>
      üretiyordu (örn. "Merkez Namaz Vakitleri 2026 | ..." 51 kez).
      <title>/og:title'a il adını ekleyerek benzersizleştiriyoruz.
      H1 ve meta description'a DOKUNULMUYOR (H1 zaten sadece ilçe
      adını içermeli — FAZ 1/2 talimatı; description zaten "(İl)"
      içeriyordu).
*/
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const dataset = require("./data/turkey-il-ilce.json");

function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, c) { fs.writeFileSync(p, c, "utf8"); }

/* ---- 1) data-city normalizasyonu ---- */
let cityFixed = 0;
for (const p of dataset.provinces) {
  const ilPath = path.join(ROOT, `${p.slug}.html`);
  let ilHtml = read(ilPath);
  const m = ilHtml.match(/data-city="([^"]+)"/);
  const wrongName = m && m[1] !== p.name ? m[1] : null;
  if (wrongName) {
    ilHtml = ilHtml.replace(`data-city="${wrongName}"`, `data-city="${p.name}"`);
    write(ilPath, ilHtml);
    cityFixed++;
  }
  for (const d of p.districts) {
    const distPath = path.join(ROOT, p.slug, d.slug, "index.html");
    if (!fs.existsSync(distPath)) continue;
    let html = read(distPath);
    const dm = html.match(/data-city="([^"]+)"/);
    if (dm && dm[1] !== p.name) {
      html = html.replace(`data-city="${dm[1]}"`, `data-city="${p.name}"`);
      write(distPath, html);
      cityFixed++;
    }
  }
}
console.log("data-city düzeltilen dosya sayısı:", cityFixed);

/* ---- 2) duplicate title -> il adıyla benzersizleştir ---- */
const nameToProvinces = new Map(); // ilçe adı -> [{slug, name}]
for (const p of dataset.provinces) {
  for (const d of p.districts) {
    const arr = nameToProvinces.get(d.name) || [];
    arr.push(p);
    nameToProvinces.set(d.name, arr);
  }
}

let titleFixed = 0;
for (const p of dataset.provinces) {
  for (const d of p.districts) {
    const collision = (nameToProvinces.get(d.name) || []).length > 1;
    if (!collision) continue;
    const distPath = path.join(ROOT, p.slug, d.slug, "index.html");
    if (!fs.existsSync(distPath)) continue;
    let html = read(distPath);
    const oldTitle = `${d.name} Namaz Vakitleri 2026 | Güncel Ezan Saatleri`;
    const newTitle = `${d.name} (${p.name}) Namaz Vakitleri 2026 | Güncel Ezan Saatleri`;
    if (html.includes(oldTitle)) {
      html = html.split(oldTitle).join(newTitle); // <title> VE og:title, ikisi de aynı metni kullanıyor
      write(distPath, html);
      titleFixed++;
    }
  }
}
console.log("Duplicate title düzeltilen (il adı eklendi) sayfa sayısı:", titleFixed);
