/* ============================================================
   tools/faz1c-route-fixes.js — FAZ 1C route düzeltmeleri
   Tek seferlik bakım betiği. Çalıştırıldıktan sonra elde tutulabilir
   (referans/izlenebilirlik için) ama tekrar çalıştırmaya gerek yoktur.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { slugify } = require("./slugify");

const ROOT = path.join(__dirname, "..");

function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }
function write(p, content) { fs.writeFileSync(path.join(ROOT, p), content, "utf8"); }
function exists(p) { return fs.existsSync(path.join(ROOT, p)); }

/* ---- 1) Yeni gerçek ilçe sayfalarının üretimi ---- */
// { il, ilSlug, yeniIlce, yeniSlug, templateIlce, templateSlug }
const NEW_PAGES = [
  { il: "Denizli", ilSlug: "denizli", yeni: "Merkezefendi", templateSlug: "acipayam" },
  { il: "Erzurum", ilSlug: "erzurum", yeni: "Palandöken", templateSlug: "aziziye" },
  { il: "Malatya", ilSlug: "malatya", yeni: "Yeşilyurt", templateSlug: "battalgazi" },
  { il: "Mardin", ilSlug: "mardin", yeni: "Artuklu", templateSlug: "kiziltepe" },
  { il: "Muğla", ilSlug: "mugla", yeni: "Menteşe", templateSlug: "bodrum" },
  { il: "Ordu", ilSlug: "ordu", yeni: "Altınordu", templateSlug: "fatsa" },
  { il: "Manisa", ilSlug: "manisa", yeni: "Şehzadeler", templateSlug: "akhisar" },
  { il: "Manisa", ilSlug: "manisa", yeni: "Yunusemre", templateSlug: "akhisar" },
];

const log = [];

for (const p of NEW_PAGES) {
  const yeniSlug = slugify(p.yeni);
  const templatePath = `${p.ilSlug}/${p.templateSlug}/index.html`;
  const targetDir = `${p.ilSlug}/${yeniSlug}`;
  const targetPath = `${targetDir}/index.html`;

  if (!exists(templatePath)) { log.push(`HATA: şablon bulunamadı ${templatePath}`); continue; }
  if (exists(targetPath)) { log.push(`ATLANDI (zaten var): ${targetPath}`); continue; }

  let html = read(templatePath);
  // Şablon ilçenin görünen adı (Title-Case) template dosyasının data-district'inden okunur
  const m = html.match(/data-district="([^"]+)"/);
  if (!m) { log.push(`HATA: data-district bulunamadı ${templatePath}`); continue; }
  const templateDistrict = m[1];
  const templateSlugAscii = p.templateSlug;

  // 1) slug (ascii, URL bağlamı: canonical/og:url) değiştir
  html = html.split(templateSlugAscii).join(yeniSlug);
  // 2) görünen ilçe adı (title-case, tüm başlık/meta/FAQ/breadcrumb/data-district/intro) değiştir
  html = html.split(templateDistrict).join(p.yeni);

  fs.mkdirSync(path.join(ROOT, targetDir), { recursive: true });
  write(targetPath, html);
  log.push(`OLUŞTURULDU: ${targetPath} (şablon: ${templatePath}, eski ilçe adı "${templateDistrict}" -> "${p.yeni}")`);
}

/* ---- 2) emirdagi -> emirdag, samandagi -> samandag rename + canonical/og:url fix ---- */
const SLUG_RENAMES = [
  { il: "afyonkarahisar", from: "emirdagi", to: "emirdag" },
  { il: "hatay", from: "samandagi", to: "samandag" },
];
for (const r of SLUG_RENAMES) {
  const fromPath = `${r.il}/${r.from}/index.html`;
  const toDir = `${r.il}/${r.to}`;
  const toPath = `${toDir}/index.html`;
  if (!exists(fromPath)) { log.push(`HATA: ${fromPath} yok`); continue; }
  let html = read(fromPath);
  html = html.split(`/${r.il}/${r.from}/`).join(`/${r.il}/${r.to}/`);
  fs.mkdirSync(path.join(ROOT, toDir), { recursive: true });
  write(toPath, html);
  fs.rmSync(path.join(ROOT, r.il, r.from), { recursive: true, force: true });
  log.push(`SLUG DÜZELTİLDİ: /${r.il}/${r.from}/ -> /${r.il}/${r.to}/`);
}

/* ---- 3) samsun bozuk-encoding klasör -> tekkekoy (ascii) ---- */
{
  const samsunDir = path.join(ROOT, "samsun");
  const entries = fs.readdirSync(samsunDir, { withFileTypes: true });
  const corrupted = entries.find((e) => e.isDirectory() && e.name !== "tekkekoy" && e.name.toLowerCase().startsWith("tekke"));
  if (corrupted) {
    const fromPath = `samsun/${corrupted.name}/index.html`;
    const toDir = "samsun/tekkekoy";
    const toPath = `${toDir}/index.html`;
    let html = read(fromPath);
    // canonical/og:url düzeltmesi: hangi karakter dizisi olursa olsun /samsun/.../ segmentini ascii'ye çevir
    html = html.replace(/\/samsun\/[^/]+\//g, "/samsun/tekkekoy/");
    fs.mkdirSync(path.join(ROOT, toDir), { recursive: true });
    write(toPath, html);
    fs.rmSync(path.join(samsunDir, corrupted.name), { recursive: true, force: true });
    log.push(`ENCODING DÜZELTİLDİ: samsun/${corrupted.name} (bozuk) -> samsun/tekkekoy`);
  } else {
    log.push("samsun: bozuk encoding klasörü bulunamadı (zaten düzeltilmiş olabilir)");
  }
}

/* ---- 4) 12 sahte "merkez" klasörünü sil (redirect _redirects'te ayrıca eklenecek) ---- */
const RETIRE_MERKEZ = ["denizli", "erzurum", "malatya", "mardin", "mugla", "ordu", "manisa", "tekirdag", "trabzon", "diyarbakir", "kahramanmaras", "van"];
for (const il of RETIRE_MERKEZ) {
  const dir = path.join(ROOT, il, "merkez");
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    log.push(`SİLİNDİ (resmi karşılığı yok): ${il}/merkez/`);
  } else {
    log.push(`ATLANDI (zaten yok): ${il}/merkez/`);
  }
}

/* ---- 5) İl sayfalarındaki ilçe link bloklarını güncelle ---- */
const PROVINCE_LINK_FIXES = [
  { file: "denizli.html", remove: [`<a href="/denizli/merkez/">Merkez</a>`], insertAfter: `<a href="/denizli/acipayam/">Acıpayam</a>`, insert: `<a href="/denizli/merkezefendi/">Merkezefendi</a>` },
  { file: "mugla.html", remove: [`<a href="/mugla/merkez/">Merkez</a>`], insertAfter: `<a href="/mugla/marmaris/">Marmaris</a>`, insert: `<a href="/mugla/mentese/">Menteşe</a>` },
  { file: "mardin.html", remove: [`<a href="/mardin/merkez/">Merkez</a>`], insertBefore: `<a href="/mardin/kiziltepe/">Kızıltepe</a>`, insert: `<a href="/mardin/artuklu/">Artuklu</a>` },
  { file: "ordu.html", remove: [`<a href="/ordu/merkez/">Merkez</a>`], insertBefore: `<a href="/ordu/fatsa/">Fatsa</a>`, insert: `<a href="/ordu/altinordu/">Altınordu</a>` },
  { file: "van.html", remove: [`<a href="/van/merkez/">Merkez</a>`] },
  { file: "erzurum.html", remove: [`<a href="/erzurum/merkez/">Merkez</a>`], insertAfter: `<a href="/erzurum/horasan/">Horasan</a>`, insert: `<a href="/erzurum/palandoken/">Palandöken</a>` },
  { file: "malatya.html", remove: [`<a href="/malatya/merkez/">Merkez</a>`], insertAfter: `<a href="/malatya/battalgazi/">Battalgazi</a>`, insert: `<a href="/malatya/yesilyurt/">Yeşilyurt</a>` },
  { file: "manisa.html", remove: [`<a href="/manisa/merkez/">Merkez</a>`], insertAfter: `<a href="/manisa/soma/">Soma</a>`, insert: `<a href="/manisa/sehzadeler/">Şehzadeler</a>\n<a href="/manisa/yunusemre/">Yunusemre</a>` },
  { file: "tekirdag.html", remove: [`<a href="/tekirdag/merkez/">Merkez</a>`] },
  { file: "trabzon.html", remove: [`<a href="/trabzon/merkez/">Merkez</a>`] },
  { file: "diyarbakir.html", remove: [`<a href="/diyarbakir/merkez/">Merkez</a>`] },
  { file: "kahramanmaras.html", remove: [`<a href="/kahramanmaras/merkez/">Merkez</a>`] },
  { file: "afyonkarahisar.html", replace: [[`<a href="/afyonkarahisar/emirdagi/">Emirdağ</a>`, `<a href="/afyonkarahisar/emirdag/">Emirdağ</a>`]] },
  { file: "hatay.html", replace: [[`<a href="/hatay/samandagi/">Samandağ</a>`, `<a href="/hatay/samandag/">Samandağ</a>`]] },
  { file: "samsun.html", replace: [[`<a href="/samsun/tekkeköy/">Tekkeköy</a>`, `<a href="/samsun/tekkekoy/">Tekkeköy</a>`]] },
];

for (const f of PROVINCE_LINK_FIXES) {
  let html = read(f.file);
  let changed = false;
  for (const r of f.remove || []) {
    if (html.includes(r)) { html = html.replace(r + "\n", ""); changed = true; }
    else log.push(`UYARI: "${r}" bulunamadı -> ${f.file}`);
  }
  if (f.insertAfter && f.insert) {
    if (html.includes(f.insertAfter)) {
      html = html.replace(f.insertAfter, `${f.insertAfter}\n${f.insert}`);
      changed = true;
    } else log.push(`UYARI: insertAfter ankoru bulunamadı -> ${f.file}`);
  }
  if (f.insertBefore && f.insert) {
    if (html.includes(f.insertBefore)) {
      html = html.replace(f.insertBefore, `${f.insert}\n${f.insertBefore}`);
      changed = true;
    } else log.push(`UYARI: insertBefore ankoru bulunamadı -> ${f.file}`);
  }
  for (const [from, to] of f.replace || []) {
    if (html.includes(from)) { html = html.replace(from, to); changed = true; }
    else log.push(`UYARI: "${from}" bulunamadı -> ${f.file}`);
  }
  if (changed) { write(f.file, html); log.push(`İL SAYFASI GÜNCELLENDİ: ${f.file}`); }
}

console.log(log.join("\n"));
