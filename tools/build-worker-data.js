/* ============================================================
   tools/build-worker-data.js — worker/locations.json üretir.
   ------------------------------------------------------------
   Worker (worker/index.mjs), il/ilçe sayfası istendiğinde günün
   vakitlerini HTML'e yazmak için URL → Diyanet ilçe ID eşlemesine
   ihtiyaç duyar. Kaynak: tools/data/turkey-il-ilce.json.
   - İlçe sayfası: ilçenin diyanetIlceId'si (Diyanet ilçeyi ayrı
     yayınlamıyorsa dataset zaten il merkezi ID'sini taşır)
   - İl sayfası: app.js ile aynı kural — Diyanet'te il adını taşıyan
     merkezi nokta, yoksa "MERKEZ"
   Ağ erişimi gerektirmez; CI'da tutarlılık kontrolü olarak çalışır.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const dataset = require("./data/turkey-il-ilce.json");

/* Dataset'te il merkezi noktası bulunmayan iller. Değer, Diyanet
   /ilceler/{SehirID} listesindeki il adlı kaydın IlceID'si. */
const PROVINCE_CENTER_OVERRIDE = { konya: "9676" };

const norm = (s) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

const out = {};
const missing = [];
for (const p of dataset.provinces) {
  const center = PROVINCE_CENTER_OVERRIDE[p.slug]
    || (p.districts.find((d) => d.diyanetIlceAdi && norm(d.diyanetIlceAdi) === norm(p.name))
      || p.districts.find((d) => d.diyanetIlceAdi && norm(d.diyanetIlceAdi) === "merkez") || {}).diyanetIlceId;
  if (center && fs.existsSync(path.join(ROOT, `${p.slug}.html`))) out[`/${p.slug}`] = { id: center, name: p.name };
  else missing.push(p.slug);

  for (const d of p.districts) {
    if (!d.dataAvailable || !d.diyanetIlceId) { missing.push(`${p.slug}/${d.slug}`); continue; }
    if (!fs.existsSync(path.join(ROOT, p.slug, d.slug, "index.html"))) continue;
    out[`/${p.slug}/${d.slug}/`] = { id: d.diyanetIlceId, name: d.name, il: p.name };
  }
}

fs.mkdirSync(path.join(ROOT, "worker"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "worker", "locations.json"), JSON.stringify(out) + "\n", "utf8");
console.log("worker/locations.json:", Object.keys(out).length, "konum");
if (missing.length) console.log("Eşlenemeyen:", missing.join(", "));
