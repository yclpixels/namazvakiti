/* ============================================================
   tools/migrations/2026-08-expand-thin-content.js
   ------------------------------------------------------------
   SEO-STRATEGY.md'nin "thin content" bulgusunu giderir:
   - 973 ilçe sayfasındaki tek cümlelik tanıtım paragrafını
     genişletir + aynı ildeki diğer ilçelere link bloğu ekler.
   - 81 il sayfasındaki tanıtım paragrafını genişletir + resmi
     ilçe sayısını ekler + hesaplama sayfasına bağlamsal link verir.
   Veri kaynağı: tools/data/turkey-il-ilce.json (canonical dataset,
   uydurma bilgi yok — sadece il/ilçe adı ve resmi ilçe sayısı).
   İdempotent: "nv-sibling-districts" / "nv-expanded-intro" işaretini
   arar, zaten işlenmiş dosyayı atlar.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const dataset = require("../data/turkey-il-ilce.json");

function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }
function write(p, c) { fs.writeFileSync(path.join(ROOT, p), c, "utf8"); }

const PILL_STYLE = 'color:#fff;text-decoration:none;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);padding:8px 14px;border-radius:11px;display:inline-block;margin:3px;font-size:13px;';
const LABEL_STYLE = 'color:rgba(245,240,230,.4);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;';

const STATS = { districtsUpdated: 0, districtsSkipped: 0, districtErrors: [], provincesUpdated: 0, provincesSkipped: 0, provinceErrors: [] };

for (const province of dataset.provinces) {
  const sortedDistricts = [...province.districts].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const total = sortedDistricts.length;

  // ── İlçe sayfaları ──────────────────────────────────────────
  for (const district of sortedDistricts) {
    const rel = `${province.slug}/${district.slug}/index.html`;
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) { STATS.districtErrors.push(`Dosya yok: ${rel}`); continue; }
    let html = read(rel);
    if (html.includes("nv-sibling-districts")) { STATS.districtsSkipped++; continue; }

    const introRe = /(<p style="color:rgba\(245,240,230,\.55\);font-size:13px;line-height:1\.7;margin-bottom:26px;">)([^<]*)(<\/p>)/;
    if (!introRe.test(html)) { STATS.districtErrors.push(`Intro paragraf bulunamadı: ${rel}`); continue; }

    const newIntro =
      `Bu sayfada ${district.name} (${province.name}) için güncel namaz vakitleri yer alır: imsak, güneş, öğle, ikindi, akşam ve yatsı. ` +
      `Vakitler, Diyanet İşleri Başkanlığı'nın resmi hesaplama yöntemiyle, ${district.name} ilçesinin coğrafi konumuna göre güneşin açısı esas alınarak belirlenir ve her gün otomatik güncellenir. ` +
      `Aşağıdaki aylık takvimden önümüzdeki günlerin vakitlerine, kıble pusulasından ise Kâbe yönüne bakabilirsiniz. ` +
      `${province.name} genelinde toplam ${total} ilçe için ayrı namaz vakti sayfası bulunuyor; alttan diğer ${province.name} ilçelerine geçebilirsiniz.`;
    html = html.replace(introRe, `$1${newIntro}$3`);

    // Komşu ilçe linkleri: aynı ildeki diğer ilçeler (en fazla 8), + il sayfasına "tümünü gör"
    const siblings = sortedDistricts.filter((d) => d.slug !== district.slug).slice(0, 8);
    const pills = siblings.map((d) => `<a href="/${province.slug}/${d.slug}/" style="${PILL_STYLE}">${d.name}</a>`).join("");
    const more = total > siblings.length + 1
      ? `<a href="/${province.slug}" style="${PILL_STYLE}">Tüm ${province.name} İlçeleri →</a>` : "";
    const siblingBlock =
      `\n    <div class="nv-sibling-districts" style="margin-bottom:26px;">` +
      `<div style="${LABEL_STYLE}">Diğer ${province.name} İlçeleri</div>${pills}${more}</div>`;

    const backLinkRe = /(<div style="margin-bottom:26px;"><a href="\/[^"]+" style="color:#fff;text-decoration:none;background:rgba\(255,255,255,\.06\);border:1px solid rgba\(255,255,255,\.08\);padding:8px 14px;border-radius:11px;display:inline-block;margin:3px;font-size:13px;">← [^<]+<\/a><\/div>)/;
    if (!backLinkRe.test(html)) { STATS.districtErrors.push(`Dön linki bulunamadı: ${rel}`); continue; }
    html = html.replace(backLinkRe, `$1${siblingBlock}`);

    write(rel, html);
    STATS.districtsUpdated++;
  }

  // ── İl sayfası ──────────────────────────────────────────────
  const provRel = `${province.slug}.html`;
  const provFull = path.join(ROOT, provRel);
  if (!fs.existsSync(provFull)) { STATS.provinceErrors.push(`Dosya yok: ${provRel}`); continue; }
  let provHtml = read(provRel);
  if (provHtml.includes("nv-expanded-intro")) { STATS.provincesSkipped++; continue; }

  const provIntroRe = /(<p style="color:rgba\(245,240,230,\.55\);font-size:13px;line-height:1\.7;margin-bottom:26px;">)([^<]*)(<\/p>)/;
  if (!provIntroRe.test(provHtml)) { STATS.provinceErrors.push(`Intro paragraf bulunamadı: ${provRel}`); continue; }

  const newProvIntro =
    `Bu sayfada ${province.name} için güncel namaz vakitleri yer alır: imsak, güneş, öğle, ikindi, akşam ve yatsı. ` +
    `Vakitler, Diyanet İşleri Başkanlığı'nın resmi hesaplama yöntemiyle her gün otomatik güncellenir. ` +
    `${province.name} genelinde toplam ${total} ilçe bulunuyor; üstteki menüden veya aşağıdaki listeden ilçenize özel sayfaya geçebilirsiniz. ` +
    `Sayfada ayrıca aylık vakit takvimi ve kıble pusulası da yer alıyor. ` +
    `Vakitlerin nasıl hesaplandığını merak ediyorsanız <a href="/namaz-vakitleri-nasil-hesaplanir" style="color:inherit;text-decoration:underline;">bu sayfadan</a> detaylı bilgi alabilirsiniz.`;
  provHtml = provHtml.replace(provIntroRe, (_m, a, _b, c) => `${a}<!-- nv-expanded-intro -->${newProvIntro}${c}`);

  write(provRel, provHtml);
  STATS.provincesUpdated++;
}

console.log("=== THIN CONTENT GENİŞLETME ===");
console.log("İlçe sayfası güncellenen:", STATS.districtsUpdated);
console.log("İlçe sayfası atlanan (zaten işlenmiş):", STATS.districtsSkipped);
console.log("İl sayfası güncellenen:", STATS.provincesUpdated);
console.log("İl sayfası atlanan (zaten işlenmiş):", STATS.provincesSkipped);
if (STATS.districtErrors.length) {
  console.log("\nİLÇE HATALARI (ilk 20):");
  STATS.districtErrors.slice(0, 20).forEach((e) => console.log("  -", e));
  console.log("Toplam ilçe hatası:", STATS.districtErrors.length);
}
if (STATS.provinceErrors.length) {
  console.log("\nİL HATALARI:");
  STATS.provinceErrors.forEach((e) => console.log("  -", e));
}
