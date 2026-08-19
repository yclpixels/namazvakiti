/* ============================================================
   tools/faz2b-build-dataset.js — FAZ 2B: Canonical il/ilçe dataset
   ------------------------------------------------------------
   İki kaynağı birleştirir:
   1) api.turkiyeapi.dev/v1/provinces — resmi idari yapı (81 il,
      973 ilçe, gerçek id'ler).
   2) ezanvakti.emushaf.net (Diyanet) — sitenin CANLI vakit verisini
      çektiği gerçek API.

   ÖNEMLİ KEŞİF (FAZ 2E sırasında bulundu): Diyanet API'si büyük il
   merkezlerinde (İstanbul, Ankara, İzmir, Bursa vb.) ilçe bazında
   değil, "il adını taşıyan" TEK bir merkezi nokta üzerinden vakit
   veriyor (örn. İstanbul'un Diyanet ilçe listesinde "İSTANBUL" diye
   bir kayıt var; Fatih/Kadıköy/Şişli gibi merkezi ilçeler ayrı
   yayınlanmıyor). Bu yüzden her resmi ilçe için 3 kademeli
   sınıflandırma yapılıyor:
     - "exact"     : Diyanet'te bu ilçe adıyla birebir kayıt var
     - "province"  : Yok, ama il adını taşıyan merkezi kayıt var
                     (app.js runtime'da bunu kullanıp kullanıcıyı
                     bilgilendiriyor — bkz. app.js init())
     - "none"      : Hiçbiri yok — bu ilçe için GERÇEK veri kaynağı
                     bulunamadı, sayfa ÜRETİLMEMELİ (FAZ 2 kuralı 5)

   Çıktı: tools/data/turkey-il-ilce.json
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { slugify } = require("./slugify");

const ROOT = path.join(__dirname, "..");
const OUT_PATH = path.join(ROOT, "tools", "data", "turkey-il-ilce.json");

function normTR(s) {
  return String(s || "").toLocaleLowerCase("tr")
    .replace(/İ/g, "i").replace(/ı/g, "i").replace(/i̇/g, "i")
    .replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ö/g, "o").replace(/ç/g, "c").trim();
}

async function main() {
  console.log("1) api.turkiyeapi.dev'den resmi il/ilçe yapısı çekiliyor...");
  const res = await fetch("https://api.turkiyeapi.dev/v1/provinces");
  if (!res.ok) throw new Error("api.turkiyeapi.dev başarısız: " + res.status);
  const officialProvinces = (await res.json()).data;
  console.log(`   ${officialProvinces.length} il alındı.`);

  console.log("2) ezanvakti.emushaf.net (Diyanet) — canlı şehir listesi çekiliyor...");
  const cityRes = await fetch("https://ezanvakti.emushaf.net/sehirler/2");
  if (!cityRes.ok) throw new Error("Diyanet /sehirler başarısız: " + cityRes.status);
  const diyanetCities = await cityRes.json();
  console.log(`   ${diyanetCities.length} şehir alındı.`);

  console.log("3) Her il için Diyanet ilçe listesi çekiliyor (81 istek, aralarda küçük bekleme + boş/başarısız sonuçlar için 3 deneme)...");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function fetchDistrictsWithRetry(sehirId, label) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(`https://ezanvakti.emushaf.net/ilceler/${sehirId}`);
        if (r.ok) {
          const json = await r.json();
          if (Array.isArray(json) && json.length > 0) return json;
        }
      } catch (e) { /* aşağıda tekrar denenecek */ }
      console.log(`   UYARI: ${label} ilçeleri boş/başarısız döndü (deneme ${attempt}/3), 500ms sonra tekrar denenecek...`);
      await sleep(500);
    }
    return [];
  }

  const diyanetDistrictsByCity = {};
  let i = 0;
  for (const c of diyanetCities) {
    i++;
    diyanetDistrictsByCity[normTR(c.SehirAdi)] = await fetchDistrictsWithRetry(c.SehirID, c.SehirAdi);
    await sleep(120);
    if (i % 20 === 0) console.log(`   ...${i}/${diyanetCities.length}`);
  }
  // Ana turda başarısız kalanlar için: bekleyip TAMAMEN ayrı, yavaş bir tur daha dene
  // (rapid-fire ardışık isteklerde bazı şehirlerin API'de tutarlı biçimde boş dönmesi
  // gözlemlendi; izole/tekil istekte aynı şehirler hep başarılı — bağlantı havuzu
  // kaynaklı geçici bir durum olduğu görülüyor).
  for (let pass = 1; pass <= 3; pass++) {
    const empty = diyanetCities.filter((c) => (diyanetDistrictsByCity[normTR(c.SehirAdi)] || []).length === 0);
    if (!empty.length) break;
    console.log(`   ${pass}. ek tur: ${empty.length} il için yavaş/izole tekrar deneniyor (${empty.map((c) => c.SehirAdi).join(", ")})...`);
    await sleep(2000);
    for (const c of empty) {
      diyanetDistrictsByCity[normTR(c.SehirAdi)] = await fetchDistrictsWithRetry(c.SehirID, c.SehirAdi);
      await sleep(800);
    }
  }
  const emptyCities = diyanetCities.filter((c) => (diyanetDistrictsByCity[normTR(c.SehirAdi)] || []).length === 0);
  if (emptyCities.length) {
    console.log(`   UYARI: ${emptyCities.length} il için TÜM denemelerde de ilçe listesi alınamadı: ${emptyCities.map((c) => c.SehirAdi).join(", ")}`);
  } else {
    console.log("   Tüm 81 il için ilçe listesi başarıyla alındı.");
  }
  console.log("   Diyanet ilçe verileri tamamlandı.");

  console.log("4) Dataset birleştiriliyor + 3 kademeli sınıflandırma...");
  const dataset = {
    generatedAt: new Date().toISOString(),
    source: { official: "api.turkiyeapi.dev/v1/provinces", live: "ezanvakti.emushaf.net" },
    provinces: [],
  };

  let totalDistricts = 0;
  const counts = { exact: 0, province: 0, none: 0 };
  const noneList = [];

  for (const p of officialProvinces) {
    const provinceSlug = slugify(p.name);
    const diyanetCity = diyanetCities.find((c) => normTR(c.SehirAdi) === normTR(p.name));
    const diyanetDistList = diyanetCity ? (diyanetDistrictsByCity[normTR(diyanetCity.SehirAdi)] || []) : [];
    const provinceLevelEntry = diyanetDistList.find((dd) => normTR(dd.IlceAdi) === normTR(p.name))
      || diyanetDistList.find((dd) => normTR(dd.IlceAdi) === "merkez");

    const provinceEntry = {
      id: provinceSlug, officialId: p.id, name: p.name, slug: provinceSlug,
      diyanetSehirId: diyanetCity ? diyanetCity.SehirID : null,
      districts: [],
    };

    for (const d of p.districts) {
      totalDistricts++;
      const districtSlug = slugify(d.name);
      const exact = diyanetDistList.find((dd) => normTR(dd.IlceAdi) === normTR(d.name));

      let matchType, diyanetIlceId, diyanetIlceAdi;
      if (exact) {
        matchType = "exact"; diyanetIlceId = exact.IlceID; diyanetIlceAdi = exact.IlceAdi; counts.exact++;
      } else if (provinceLevelEntry) {
        matchType = "province"; diyanetIlceId = provinceLevelEntry.IlceID; diyanetIlceAdi = provinceLevelEntry.IlceAdi; counts.province++;
      } else {
        matchType = "none"; diyanetIlceId = null; diyanetIlceAdi = null; counts.none++;
        noneList.push(`${p.name} / ${d.name}`);
      }

      provinceEntry.districts.push({
        id: `${provinceSlug}-${districtSlug}`, officialId: d.id,
        provinceId: provinceSlug, provinceName: p.name,
        name: d.name, slug: districtSlug,
        matchType, dataAvailable: matchType !== "none",
        diyanetIlceId, diyanetIlceAdi,
      });
    }
    dataset.provinces.push(provinceEntry);
  }

  dataset.summary = { totalProvinces: officialProvinces.length, totalDistricts, ...counts };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(dataset, null, 2), "utf8");

  console.log("\n=== ÖZET ===");
  console.log("Toplam il:", dataset.summary.totalProvinces);
  console.log("Toplam resmi ilçe:", dataset.summary.totalDistricts);
  console.log("  exact (Diyanet'te birebir var):", counts.exact);
  console.log("  province (il-merkezi yaklaşık değer, not ile):", counts.province);
  console.log("  none (hiç veri yok, sayfa üretilmeyecek):", counts.none);
  if (noneList.length) {
    console.log("\n'none' (veri bulunamayan) ilçeler:");
    noneList.forEach((u) => console.log("  -", u));
  }
  console.log(`\nDataset yazıldı: ${OUT_PATH}`);
}

main().catch((e) => { console.error("HATA:", e); process.exit(1); });
