/* ============================================================
   worker/index.mjs — il/ilçe sayfalarına günün vakitlerini yazar.
   ------------------------------------------------------------
   Site statik kalır; bu Worker yalnızca HTML isteklerinde çalışır
   (wrangler.jsonc → run_worker_first). İstenen yol bir il/ilçe
   sayfasıysa (worker/locations.json) Diyanet API'sinden o günün
   vakitlerini alır ve HTMLRewriter ile:
   - #prayerGrid'e vakit kartlarını (app.js yüklenince kendi
     render'ıyla değiştirir; JS'siz tarayıcı ve arama motoru da görür)
   - #cdSub'a günün vakitlerini cümle olarak
   - #heroHijri'ye hicri tarihi
   - meta description'a bugünün vakitlerini
   yazar. Her hata durumunda sayfa olduğu gibi (statik) döner.
   Uydurma veri yok: API cevap vermezse hiçbir şey eklenmez.
   ============================================================ */
import LOCATIONS from "./locations.json";

const API = "https://ezanvakti.emushaf.net";
const API_TIMEOUT_MS = 1500;
const PRAYERS = [
  ["Imsak", "İmsak", "imsak"], ["Gunes", "Güneş", "gunes"], ["Ogle", "Öğle", "ogle"],
  ["Ikindi", "İkindi", "ikindi"], ["Aksam", "Akşam", "aksam"], ["Yatsi", "Yatsı", "yatsi"],
];

/* İzolat ömrü boyunca küçük bellek önbelleği: id|tarih → kayıt */
const memo = new Map();

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function todayTR() {
  // "20.10.2026" — API'nin MiladiTarihKisa biçimi, Türkiye saatine göre
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year}`;
}

async function getDay(id) {
  const date = todayTR();
  const key = `${id}|${date}`;
  if (memo.has(key)) return memo.get(key);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/vakitler/${id}`, { signal: ctrl.signal, cf: { cacheTtl: 21600, cacheEverything: true } });
    if (!res.ok) return null;
    const list = await res.json();
    const rec = Array.isArray(list) ? list.find((r) => r.MiladiTarihKisa === date) : null;
    const ok = rec && PRAYERS.every(([k]) => /^\d{2}:\d{2}$/.test(rec[k] || ""));
    if (!ok) return null;
    if (memo.size > 2000) memo.clear();
    memo.set(key, rec);
    return rec;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function gridHtml(rec) {
  return PRAYERS.map(([k, label, ico]) => `<div class="lx-t" data-prayer="${k}">
        <span class="lx-t-dot" aria-hidden="true"></span>
        <div class="lx-t-name"><span class="nv-ico"><img src="/assets/icons/nv/${ico}.webp" width="22" height="22" alt="" decoding="async"/></span>${label}</div>
        <div class="lx-t-time">${esc(rec[k])}</div>
        <div class="lx-t-sub"></div>
      </div>`).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const loc = request.method === "GET" ? LOCATIONS[url.pathname] : null;
    if (!loc) return env.ASSETS.fetch(request);

    // Sayfa her gün değişir: koşullu istekleri (ETag/304) asset katmanına iletme
    const headers = new Headers(request.headers);
    headers.delete("If-None-Match");
    headers.delete("If-Modified-Since");
    const asset = await env.ASSETS.fetch(new Request(request, { headers }));
    if (asset.status !== 200 || !(asset.headers.get("content-type") || "").includes("text/html")) return asset;

    const rec = await getDay(loc.id);
    if (!rec) return asset;

    const place = loc.il ? `${loc.name} (${loc.il})` : loc.name;
    const times = PRAYERS.map(([k, label]) => `${label.toLocaleLowerCase("tr")} ${rec[k]}`).join(", ");
    const sentence = `${rec.MiladiTarihUzun} — ${place} namaz vakitleri: ${times}. Kaynak: Diyanet İşleri Başkanlığı.`;
    const desc = `${place} namaz vakitleri bugün (${rec.MiladiTarihUzun}): İmsak ${rec.Imsak}, Öğle ${rec.Ogle}, İkindi ${rec.Ikindi}, Akşam ${rec.Aksam}, Yatsı ${rec.Yatsi}. Aylık imsakiye ve kıble yönü.`;

    const out = new HTMLRewriter()
      .on('meta[name="description"]', { element(el) { el.setAttribute("content", desc); } })
      .on("#prayerGrid", { element(el) { el.setInnerContent(gridHtml(rec), { html: true }); } })
      .on("#cdSub", { element(el) { el.setInnerContent(sentence); } })
      .on("#heroHijri", { element(el) { if (rec.HicriTarihUzun) el.setInnerContent(rec.HicriTarihUzun); } })
      .transform(asset);

    const res = new Response(out.body, out);
    res.headers.delete("ETag");
    res.headers.delete("Last-Modified");
    res.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    return res;
  },
};
