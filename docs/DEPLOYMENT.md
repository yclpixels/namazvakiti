# Deployment

Bu doküman sitenin nasıl yayınlandığını anlatır. Hiçbir kimlik bilgisi/secret bu dosyada bulunmaz.

## Mimari

```
Yerel geliştirme (Windows veya macOS)
      ↓  git push origin main
GitHub — yclpixels/namazvakiti (public)
      ↓  Cloudflare Workers Builds (otomatik, ~1 dk)
Cloudflare Worker "namazvakiti" (statik dosyalar + worker/index.mjs)
      ↓
namazvakiti.net + www.namazvakiti.net (Worker Custom Domain)
```

Netlify artık kullanılmıyor. DNS ve nameserver'lar Cloudflare'de.

## Yayınlama

`main` dalına yapılan her push otomatik yayınlanır. Build adımı yoktur — repo kökü olduğu gibi statik dosya olarak sunulur. Yapılandırma `wrangler.jsonc`'de; içindeki `name` mutlaka `namazvakiti` kalmalı, yoksa yeni bir Worker oluşur.

### Worker (worker/index.mjs)

İl ve ilçe sayfası istendiğinde Diyanet API'sinden o günün vakitlerini alıp HTML'e yazar (vakit kartları, `#cdSub` cümlesi, hicri tarih, meta description). Böylece arama motorları ve JS'siz tarayıcılar vakitleri görür. API 1,5 sn içinde cevap vermezse sayfa statik haliyle döner.

- Hangi isteklerin Worker'dan geçtiği `wrangler.jsonc` → `assets.run_worker_first` ile sınırlı: yalnızca uzantısız sayfa yolları. JS/CSS/görsel/sitemap gibi dosyalar ücretsiz statik katmandan sunulur ve günlük 100 bin Worker çağrısı limitine sayılmaz. Ana sayfa (`/`) ve `.html` istekleri de hariç.
- URL → Diyanet ilçe ID eşlemesi `worker/locations.json`; `node tools/build-worker-data.js` ile üretilir (CI tutarlılığı kontrol eder). Yeni il/ilçe sayfası eklenirse script'i çalıştırın.
- `not_found_handling: "404-page"` — bilinmeyen URL'ler 404 durum koduyla `404.html` döner.
- Yerel test: repo kopyasında `npx wrangler dev` (bkz. CLAUDE.md).
- Günlük çağrı sayısı Cloudflare panelinde Workers → namazvakiti → Metrics'te görünür. 100 bine yaklaşırsa Workers Paid (5$/ay) planına geçilmeli; aksi halde limit aşımında sayfalar hata verir.

### IndexNow

`.github/workflows/ci.yml` → `indexnow` işi, `main`'e her push'ta değişen HTML sayfalarını IndexNow'a (Bing, Yandex vb.) bildirir. Anahtar dosyası kökteki 32 karakterlik `<anahtar>.txt`; silinmemeli/yeniden adlandırılmamalı.

Yayını doğrulamak için canlıda önbelleği atlayan bir sorgu ekleyin, ör. `curl -sI "https://namazvakiti.net/?nc=123"`.

## Hosting-seviyesi dosyalar

- **`_headers`** — güvenlik header'ları (CSP dahil) ve cache kuralları. Yeni bir dış API'ye `fetch` eklerseniz domain'ini CSP `connect-src` listesine eklemeyi unutmayın; yoksa istek canlıda sessizce engellenir (yerel dev sunucusu `_headers` uygulamadığı için yerelde fark edilmez).
- **`_redirects`** — 301 yönlendirmeleri. `wrangler dev` ile yerelde test edilebilir. Türkçe karakter içeren kaynak yollar (ör. `/samsun/tekkeköy/`) yerelde çalışır ama canlıda eşleşmez.
- **`.assetsignore`** — `.git`, `tools/`, `docs/`, `.claude/`, README gibi dosyaların herkese açık sunulmasını engeller. Kökte yayınlanmaması gereken yeni bir klasör/dosya eklerseniz buraya ekleyin.

## Cloudflare panel ayarları (zone seviyesi)

Bunlar kodda değil, Cloudflare panelinde tanımlı:

- **SSL/TLS → Edge Certificates → Always Use HTTPS: On** (http → https, 301)
- **Rules → Redirect Rules:** `https://www.*` → `https://${1}`, 301, query string korunur (www → apex)

`www`, normal bir DNS kaydı değil, Worker Custom Domain olarak bağlı. Panel redirect kuralı oluştururken "www proxied değil" uyarısı verir — bu yanlış alarm, "Ignore and deploy" seçilmeli. `www` için ayrıca DNS kaydı **oluşturmayın**; Custom Domain ile çakışır.

Host/şema yönlendirmelerini Worker koduyla yapmayın: Worker'dan geçen her istek ücretsiz plandaki günlük 100 bin çağrı limitine sayılır. Statik dosya istekleri ücretsiz ve sınırsızdır.

## Google Search Console

Mülk sahipliği DNS TXT kaydıyla (`google-site-verification=...`) doğrulanmış; kökteki `google*.html` dosyaları yedek doğrulama içindir. Sitemap: `https://namazvakiti.net/sitemap.xml`.

## Ortam değişkenleri / secrets

Projede API anahtarı veya secret yoktur. Kullanılan dış servisler (Diyanet API, OpenStreetMap Nominatim/Overpass, Open-Meteo, alquran.cloud) anahtarsızdır. Google Analytics ölçüm ID'si, AdSense yayıncı ID'si ve Google OAuth Client ID tanım gereği herkese açık değerlerdir.
