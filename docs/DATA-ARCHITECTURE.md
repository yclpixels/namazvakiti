# Veri Mimarisi

Bu doküman, NamazVakti.net'in namaz vakti verisini nereden aldığını, nasıl işlediğini ve "il-merkezi yaklaşık veri" durumunu nasıl ele aldığını açıklar.

## Veri Kaynağı

Namaz vakitleri, Diyanet İşleri Başkanlığı'nın hesaplama yöntemine dayanan [`ezanvakti.emushaf.net`](https://ezanvakti.emushaf.net) API'sinden **tamamen istemci tarafında (client-side), sayfa yüklendiğinde canlı olarak** çekilir. Statik HTML dosyaları hiçbir vakit verisi içermez — sadece SEO/ilk-render için sayfanın hangi il/ilçeye ait olduğunu belirten `data-city`/`data-district` attribute'larını taşır.

İl/ilçe idari referans verisi (hangi ilin hangi ilçelere sahip olduğu, resmi isimler) [`api.turkiyeapi.dev`](https://api.turkiyeapi.dev) üzerinden alınır — bu, Diyanet API'sinden **bağımsız, ayrı bir kaynaktır** ve sadece hangi sayfaların üretilmesi gerektiğini belirlemek için kullanılır.

## Kritik Bir Veri Gerçeği: Diyanet API'si İlçe Bazında Çalışmaz

Diyanet API'si, Türkiye'nin 973 resmi ilçesinin **tamamı için ayrı bir kayıt tutmaz**. Özellikle büyükşehir statüsündeki illerde (İstanbul, Ankara, İzmir, Bursa vb.), birçok merkezi ilçe için ayrı vakit yayınlanmaz — bunun yerine il adını taşıyan **tek bir "merkezi nokta"** kullanılır (örn. İstanbul'un Diyanet ilçe listesinde "İSTANBUL" adında bir kayıt vardır; bu kayıt Fatih, Kadıköy, Şişli, Beşiktaş gibi merkezi ilçelerin **hepsi için ortak** kullanılır — çünkü bu ilçeler arasındaki güneş açısı farkı, pratik olarak namaz vakitlerinde anlamlı bir fark yaratmayacak kadar küçüktür).

### Bu proje bunu nasıl ele alıyor

`tools/build-dataset.js`, her resmi ilçe için canlı Diyanet API'sini sorgulayıp üç kategoriden birine ayırır:

| Kategori | Anlamı | Sayı (2026-08 itibarıyla) |
|---|---|---|
| `exact` | Diyanet API'sinde bu ilçe adıyla birebir bir kayıt var | 766 |
| `province` | Yok, ama il adını taşıyan merkezi kayıt kullanılabilir | 207 |
| `none` | Hiçbir veri kaynağı bulunamadı | 0 (şu an için — tüm resmi ilçeler için bir kaynak mevcut) |

Bu sınıflandırma `tools/data/turkey-il-ilce.json` dosyasında saklanır ve **hem** sayfa üretimi (`tools/generate-pages.js`) **hem de** çalışma zamanı (`app.js`) tarafından kullanılır.

### Çalışma zamanı davranışı (`app.js`)

Bir ilçe sayfası yüklendiğinde:

1. **Tam eşleşme denenir** — Diyanet API'sinin döndürdüğü ilçe listesinde sayfanın ilçesiyle birebir aynı isimde bir kayıt aranır.
2. **Bulunamazsa, il-merkezi kaydı denenir** — il adını taşıyan kayıt kullanılır **ve kullanıcıya açık bir bilgi notu gösterilir**: *"Diyanet, {ilçe} için ayrı vakit yayınlamıyor; {il} geneli için hesaplanan merkezi vakitler gösteriliyor."*
3. **Hiçbiri yoksa**, sayfa açıkça "bu ilçe için namaz vakti verisi şu anda bulunamadı" mesajı gösterir.

**Kritik garanti:** Sistem **hiçbir zaman** başka, alakasız bir ilçenin verisini sessizce göstermez. (Bu proje geliştirme sürecinde, düzeltmeden önce tam olarak bu hata mevcuttu — bkz. proje geçmişi — ve kod seviyesinde kalıcı olarak engellendi.)

## Sayfa Üretimi

`tools/generate-pages.js`, `tools/data/turkey-il-ilce.json`'daki dataset'i okuyarak eksik ilçe sayfalarını üretir:

- Her yeni sayfa, aynı ildeki **mevcut, doğru çalışan bir sayfa şablon alınarak** üretilir (tasarım/CSS/JS birebir korunur).
- Script **idempotent**'tir — zaten var olan sayfalara dokunmaz, tekrar çalıştırıldığında aynı sonucu üretir.
- Resmi karşılığı olmayan ("Merkez" gibi, 2014 Büyükşehir Yasası sonrası kaldırılmış idari birimler) sahte sayfalar **hiçbir zaman üretilmez** — dataset zaten sadece gerçek resmi ilçeleri içerir.

## Veri Doğrulama

`tools/quality-gate.js`, üretilen 973 ilçe sayfasının tamamını denetler: canonical doğruluğu, başlık benzersizliği, doğru `data-city`/`data-district`, breadcrumb/structured data varlığı, sitemap'te bulunma, robots/noindex durumu ve boş-içerik kontrolü.
