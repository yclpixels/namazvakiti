# Deployment

Bu doküman, projenin dağıtım (deployment) akışını ve mevcut migration durumunu açıklar. Hiçbir kimlik bilgisi/secret bu dosyada bulunmaz.

## Hedef Mimari

```
Local geliştirme
      ↓
GitHub (kaynak kontrol + sürüm geçmişi)
      ↓
Cloudflare Pages (build/hosting)
      ↓
Cloudflare DNS (namazvakiti.net)
```

## Mevcut Durum

> Bu bölüm, migration ilerledikçe güncellenmelidir.

- **Kaynak kontrol:** Proje bu depoda Git ile takip ediliyor.
- **Hosting (mevcut/geçiş öncesi):** Netlify (`namazvakiti.net` şu an Netlify üzerinden servis ediliyor).
- **Hosting (hedef):** Cloudflare Pages.
- **DNS (mevcut):** Nameserver bilgisi için domain registrar panelini kontrol edin.
- **DNS (hedef):** Cloudflare DNS.

Netlify, Cloudflare Pages tam olarak doğrulanana ve DNS kesintisiz şekilde geçirilene kadar **kesintiye uğratılmaz** — bu, kasıtlı bir güvenlik önlemidir (site kesintisi riski minimize edilir).

## Build

Bu proje bir **statik site**'dir — build adımı gerekmez. Cloudflare Pages yapılandırmasında:

- **Build command:** (boş bırakılabilir — statik dosyalar doğrudan servis edilir)
- **Output directory:** proje kök dizini (`/`)
- **Node.js sürümü:** `tools/` altındaki geliştirme script'leri Node.js gerektirir (site çalışması için değil, sadece bakım/üretim script'leri için).

## Hosting-seviyesi Yapılandırma

- **`_headers`** — HTTP güvenlik header'ları (CSP, X-Frame-Options, vb.) ve cache-control kuralları. Cloudflare Pages, Netlify ile aynı `_headers` dosya formatını destekler.
- **`_redirects`** — 301 yönlendirmeleri ve 404 catch-all kuralı. **Önemli:** Bu dosyadaki `!` (force) söz dizimi Netlify'a özgüdür; Cloudflare Pages'e geçişte bu kuralların davranışı yeniden doğrulanmalıdır.

## Ortam Değişkenleri / Secrets

Bu projede **hiçbir API anahtarı veya secret bulunmaz** — kullanılan tüm dış servisler (Diyanet API, OpenStreetMap Nominatim/Overpass) anahtarsız, herkese açık API'lerdir. Google Analytics ölçüm ID'si (`G-...`) ve Google OAuth Client ID zaten tanım gereği herkese açık, istemci tarafında görünür değerlerdir — bunlar secret değildir ve kaynak kodda görünmeleri normaldir.

## DNS Migration

DNS geçişi bu projenin en kritik aşamasıdır. Mevcut DNS kayıtları (A/AAAA/CNAME/MX/TXT/CAA/NS) değiştirilmeden önce yedeklenmeli, özellikle e-posta (MX, SPF, DKIM, DMARC) ve doğrulama (Google Search Console vb.) kayıtları korunmalıdır. Nameserver değişikliği **sadece domain registrar panelinden, proje sahibi tarafından** yapılabilir — bu depodaki hiçbir araç registrar erişimi gerektirmez veya bunu otomatikleştirmez.
