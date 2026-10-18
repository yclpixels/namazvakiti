# namazvakiti.net

Türkiye'nin 81 il + 973 ilçesi için namaz vakitleri sunan statik site (build adımı yok). Genel bilgi: `README.md`. Yayın ve Cloudflare kurulumu: `docs/DEPLOYMENT.md` — Cloudflare/Search Console/yönlendirme konularında önce onu okuyun.

Kullanıcıyla Türkçe konuşun.

## Çalıştırma

```bash
node tools/dev-server.js   # http://localhost:8083 (.claude/launch.json: "static-preview")
```

Bağımlılık yok, sadece Node.js gerekir. Yerel dev sunucusu `_headers` (CSP) ve `_redirects` uygulamaz; bunları test etmek için `npx wrangler dev --assets <kopya-klasör>` kullanın — repo kökünde çalıştırırsanız kendi `.wrangler/` klasörüne yazdıkça sürekli yeniden başlar.

## Push'tan önce (CI ile aynı kontroller)

```bash
for f in app.js sw.js tools/*.js tools/migrations/*.js; do node --check "$f"; done
node tools/generate-pages.js && git status --porcelain   # değişiklik çıkmamalı
node tools/build-sitemap.js && git status --porcelain    # değişiklik çıkmamalı
node tools/quality-gate.js                               # 973/973 geçmeli
```

`main`'e push = canlıya yayın (~1 dk). Commit/push için kullanıcıdan onay alın.

## Dikkat edilecekler

- **Önbellek kırma:** `app.js` veya `assets/style.css` değişince tüm HTML'lerdeki `?v=N` numarasını bir artırın (şu an `app.js?v=13`, `style.css?v=12`). Toplu değişiklikleri script ile yapın — 1000+ HTML dosyası ortak şablon kullanmıyor, her sayfa kendi kopyasını taşıyor.
- **Sitemap elle düzenlenmez:** yeni statik sayfa eklerken `tools/build-sitemap.js` içindeki `STATIC_PAGES` listesine ekleyip script'i çalıştırın. Ayrıca `.assetsignore` ve tüm sayfalardaki footer link bloğunu kontrol edin.
- **Yeni dış API:** domain'ini `_headers` içindeki CSP `connect-src`'ye ekleyin, yoksa canlıda sessizce engellenir.
- **JSON-LD:** yeni şema yazınca tüm `application/ld+json` bloklarını `JSON.parse` ile doğrulayın (FAQPage'de eksik `}` hatası daha önce 3 kez yapıldı).
- **Toplu HTML düzenlemeleri** `tools/migrations/YYYY-MM-*.js` altında idempotent Node script'i olarak yazılır.
- **Uydurma veri yok:** vakitler Diyanet API'sinden canlı gelir; ayetler `api.alquran.cloud` (`tr.diyanet`) üzerinden çekilir, elle yazılmaz. Veri gelmezse alan boş kalır.
- `LocalBusiness`/`Review`/`AggregateRating` şeması eklenmez.
- `internal-notes/` git'e girmez (repo public); eski aşama raporlarıdır, çalışmak için gerekmez.

## Hesaplar

- Cloudflare: kullanıcının yclpixels hesabı. Yeni bilgisayarda `npx wrangler login` gerekir (girişi kullanıcı tarayıcıda kendisi yapar). Wrangler token'ı Workers yazma yetkisine sahip ama zone ayarlarını (DNS, Redirect Rules, SSL) değiştiremez — bunlar kullanıcıya panel adımlarıyla tarif edilir.
- Claude hiçbir hesaba (Google, Cloudflare paneli vb.) şifreyle giriş yapmaz.
