# Deployment

Bu doküman sitenin nasıl yayınlandığını anlatır. Hiçbir kimlik bilgisi/secret bu dosyada bulunmaz.

## Mimari

```
Yerel geliştirme (Windows veya macOS)
      ↓  git push origin main
GitHub — yclpixels/namazvakiti (public)
      ↓  Cloudflare Workers Builds (otomatik, ~1 dk)
Cloudflare Worker "namazvakiti" (yalnızca statik dosya / assets-only)
      ↓
namazvakiti.net + www.namazvakiti.net (Worker Custom Domain)
```

Netlify artık kullanılmıyor. DNS ve nameserver'lar Cloudflare'de.

## Yayınlama

`main` dalına yapılan her push otomatik yayınlanır. Build adımı yoktur — repo kökü olduğu gibi statik dosya olarak sunulur. Repoda `wrangler.jsonc` yok; Cloudflare projeyi otomatik algılıyor. Bir Worker script'i eklemek gerekirse config'deki `name` mutlaka `namazvakiti` olmalı, yoksa yeni bir Worker oluşur.

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

Host/şema yönlendirmelerini Worker koduyla yapmayın: her isteği Worker'dan geçirmek ücretsiz plandaki günlük 100 bin çağrı limitine sayılır. Statik dosya istekleri ücretsiz ve sınırsızdır.

## Google Search Console

Mülk sahipliği DNS TXT kaydıyla (`google-site-verification=...`) doğrulanmış; kökteki `google*.html` dosyaları yedek doğrulama içindir. Sitemap: `https://namazvakiti.net/sitemap.xml`.

## Ortam değişkenleri / secrets

Projede API anahtarı veya secret yoktur. Kullanılan dış servisler (Diyanet API, OpenStreetMap Nominatim/Overpass, Open-Meteo, alquran.cloud) anahtarsızdır. Google Analytics ölçüm ID'si, AdSense yayıncı ID'si ve Google OAuth Client ID tanım gereği herkese açık değerlerdir.
