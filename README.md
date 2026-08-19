# NamazVakti.net

Türkiye'nin 81 ili ve 973 resmi ilçesi için güncel namaz vakitlerini, kıble yönünü ve yakındaki camileri gösteren, SEO odaklı bir statik web sitesi.

**Canlı site:** [namazvakiti.net](https://namazvakiti.net)

---

## Overview

NamazVakti.net, Diyanet İşleri Başkanlığı kaynaklı namaz vakti verisini il ve ilçe bazında sunan, programatik olarak üretilmiş 1.000'den fazla sayfadan oluşan bir platformdur. Proje; il/ilçe idari yapısını resmi bir referans veri setiyle doğrulayan, her sayfa için canlı API'de gerçekten veri bulunduğunu teyit eden ve kullanıcıya veri kaynağının kesinliği hakkında şeffaf bilgi veren bir üretim (generation) hattı içerir.

## Features

- **Türkiye genelinde il ve ilçe bazlı namaz vakitleri** — 81 il + 973 ilçe sayfası, tamamı resmi idari veri setiyle doğrulanmış.
- **Günlük namaz vakitleri + sıradaki vakte canlı geri sayım.**
- **Aylık vakit takvimi** (varsayılan 7 gün, genişletilebilir 30 gün görünümü).
- **Kıble pusulası** (cihaz konumu + yön sensörü ile).
- **Yakındaki camiler** (OpenStreetMap Overpass API ile, mesafe ve yürüme süresi tahmini).
- **Hicri tarih gösterimi ve Ramazan ayı bilgilendirmesi** (canlı API verisine dayalı, sabit/hardcoded değil).
- **Veri kaynağı şeffaflığı:** Diyanet API'si bazı ilçelerde (özellikle büyükşehir merkezlerinde) ilçe bazında değil, il-merkezi bazında veri döndürür. Bu durumda kullanıcıya *"Diyanet, X için ayrı vakit yayınlamıyor; il geneli için hesaplanan merkezi vakitler gösteriliyor"* şeklinde açık bir bilgilendirme gösterilir — hiçbir sayfa, başka bir ilçenin verisini sessizce/yanlışlıkla göstermez.
- **Responsive tasarım** (mobil öncelikli, ek framework/build adımı gerektirmeyen saf CSS).
- **SEO odaklı il/ilçe route mimarisi** — her sayfa için benzersiz title/description, canonical URL, tek H1, FAQPage + BreadcrumbList structured data.
- **Programatik sayfa üretimi** — 973 ilçe sayfası, tek bir canonical veri setinden idempotent bir script ile üretilir (bkz. [`docs/DATA-ARCHITECTURE.md`](docs/DATA-ARCHITECTURE.md)).
- **PWA desteği** — service worker ile temel çevrimdışı kabuk önbellekleme.
- **Google Analytics 4** entegrasyonu.
- **Güvenlik header'ları** — Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security (bkz. [`_headers`](_headers)).
- **Cloudflare Pages deployment'a hazır** statik site mimarisi.

## Tech Stack

- **Frontend:** Saf HTML5, CSS3 (inline, framework yok), vanilla JavaScript (build adımı gerektirmez).
- **Build/otomasyon tooling:** Node.js (sadece `tools/` altındaki geliştirme script'leri için — sitenin kendisi build gerektirmez, doğrudan statik dosyalardır).
- **Veri kaynağı:** [Diyanet İşleri Başkanlığı vakit API'si](https://ezanvakti.emushaf.net) (gayriresmî halka açık wrapper), il/ilçe idari referans verisi için [api.turkiyeapi.dev](https://api.turkiyeapi.dev).
- **Konum/harita servisleri:** OpenStreetMap Nominatim (ters coğrafi kodlama) ve Overpass API (yakındaki camiler).
- **Hosting:** Cloudflare Pages (migration devam ediyor — mevcut durum için bkz. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).
- **Analytics:** Google Analytics 4.

## Architecture

Site tamamen statik HTML dosyalarından oluşur — sunucu tarafı render veya framework yoktur. Her il/ilçe sayfası aynı HTML/CSS iskeletini paylaşır; sayfaya özgü içerik (başlık, meta, başlangıç `data-city`/`data-district` attribute'ları) üretim sırasında enjekte edilir. Sayfa yüklendiğinde `app.js`, ilgili il/ilçe için Diyanet API'sinden canlı veri çeker ve arayüzü doldurur — statik HTML sadece SEO/ilk-render iskeleti sağlar, gerçek vakit verisi her zaman canlıdır.

```
/                          → Ana sayfa
/{il}.html                 → İl sayfası (81 adet)
/{il}/{ilce}/               → İlçe sayfası (973 adet)
/sehirler.html              → Tüm iller dizini
/sitemap.xml, /robots.txt   → SEO altyapısı
/app.js                     → Tüm sayfalarda paylaşılan uygulama mantığı
/sw.js                      → Service worker (PWA)
/tools/                     → Sayfa üretimi ve bakım script'leri (Node.js)
```

## Data

Namaz vakti verisi [Diyanet İşleri Başkanlığı](https://www.diyanet.gov.tr/) kaynaklıdır, [ezanvakti.emushaf.net](https://ezanvakti.emushaf.net) API'si üzerinden çekilir.

**Önemli bir veri gerçeği:** Diyanet'in API'si her idari ilçe için ayrı bir kayıt tutmaz — büyükşehir merkezlerinde (İstanbul, Ankara, İzmir gibi) birçok merkezi ilçe, il adını taşıyan tek bir "merkezi nokta" üzerinden hesaplanır. Bu proje bunu **görmezden gelmek yerine açıkça ele alır**:

- 973 resmi ilçenin **766'sı** Diyanet API'sinde birebir kendi adıyla bulunur (tam eşleşme).
- **207'si** için Diyanet ayrı veri yayınlamaz; bu ilçelerde il-merkezi verisi kullanılır ve sayfada kullanıcıya açık bir bilgi notu gösterilir.
- **Hiçbir ilçe için veri "uydurulmaz"** — 973 ilçenin tamamı için canlı API'de gerçek bir veri kaynağı (tam veya yaklaşık) önceden doğrulanmıştır.

Detaylı mimari: [`docs/DATA-ARCHITECTURE.md`](docs/DATA-ARCHITECTURE.md).

## SEO

- Her il/ilçe sayfası: benzersiz `<title>`, meta description, self-referencing canonical URL, tek `<h1>`, mantıklı heading hiyerarşisi.
- `FAQPage` ve `BreadcrumbList` JSON-LD structured data (81 il + 973 ilçe sayfasında).
- Görsel + semantik breadcrumb navigasyonu (Ana Sayfa › İl › İlçe).
- `sitemap.xml` — sadece 200 dönen, canonical, gerçek içerik barındıran URL'ler (1061 URL).
- `robots.txt` — hiçbir önemli kaynağı yanlışlıkla engellemez.
- İl sayfaları, kendi ilçelerinin tamamına otomatik/dataset-tabanlı iç linkler içerir.

## Security

- **XSS koruması:** Dış kaynaklardan (OpenStreetMap Overpass) gelen kullanıcı-tanımlı veri (örn. cami isimleri), DOM'a yazılmadan önce HTML-escape edilir veya güvenli DOM API'leri (`textContent`, `createElement`) ile işlenir.
- **HTTP güvenlik header'ları** (`_headers`): Content-Security-Policy (gerçekten kullanılan kaynaklarla — Google Analytics, Google Girişi, Diyanet API, OpenStreetMap — sınırlandırılmış), X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security.
- Projede hiçbir API anahtarı/secret bulunmaz — kullanılan tüm dış servisler (Diyanet, OpenStreetMap) anahtarsız, herkese açık API'lerdir.

## Performance

Gerçek ölçülen (canlı tarayıcı Performance API ile, framework/simülasyon olmadan) bazı değerler:
- Ana sayfa HTML transfer boyutu: ~24 KB (Brotli sıkıştırmalı).
- Render-blocking harici CSS/JS yok (CSS inline, JS `</body>` sonunda/`async`).

Core Web Vitals (LCP/INP/CLS) için gerçek Lighthouse/PageSpeed Insights ölçümü bu depoda **belgelenmemiştir** — üretilmemiş/tahmini metrik paylaşılmamıştır; gerekiyorsa [PageSpeed Insights](https://pagespeed.web.dev) ile bağımsız ölçülmelidir.

## Development

Proje bir build adımı gerektirmez — statik dosyaları doğrudan herhangi bir statik dosya sunucusuyla çalıştırabilirsiniz:

```bash
node tools/dev-server.js
# http://localhost:8083
```

İlçe veri setini yeniden oluşturmak (resmi kaynak + canlı Diyanet API doğrulamasıyla):

```bash
node tools/build-dataset.js
```

Eksik ilçe sayfalarını üretmek (idempotent — var olan doğru sayfalara dokunmaz):

```bash
node tools/generate-pages.js
```

Sitemap'i dataset ve disk durumuna göre yeniden üretmek:

```bash
node tools/build-sitemap.js
```

Tüm ilçe sayfalarını SEO/veri doğruluğu açısından denetlemek:

```bash
node tools/quality-gate.js
```

## Deployment

Bkz. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Cloudflare Pages'e geçiş süreci ve mevcut durum orada detaylandırılmıştır.

## Project Structure

```
.
├── index.html                  Ana sayfa
├── {il}.html                   81 il sayfası
├── {il}/{ilce}/index.html      973 ilçe sayfası
├── app.js                      Paylaşılan uygulama mantığı
├── sw.js                       Service worker
├── manifest.webmanifest        PWA manifest
├── sitemap.xml, robots.txt     SEO altyapısı
├── _headers, _redirects        Hosting-seviyesi header/redirect kuralları
├── assets/                     İkon, görsel varlıklar
├── tools/                      Node.js üretim ve bakım script'leri
│   ├── data/                   Canonical il/ilçe veri seti (JSON)
│   └── migrations/             Tek seferlik, tarihsel düzeltme script'leri
└── docs/                       Mimari ve deployment dokümantasyonu
```

## License

Bu depo için henüz bir lisans seçilmemiştir. Site, Diyanet İşleri Başkanlığı'nın kamuya açık namaz vakti verisini ve OpenStreetMap katkıcılarının (ODbL lisanslı) verisini kullanır; kaynak kodun kendisi için lisans tercihi proje sahibine aittir.
