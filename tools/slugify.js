/* ============================================================
   tools/slugify.js — Merkezi il/ilçe slug fonksiyonu
   ------------------------------------------------------------
   Bu proje bir build sistemine sahip değil (404 il/ilçe HTML
   dosyası elle/farklı zamanlarda üretilmiş statik çıktıdır).
   Bu dosya, sitede fiilen kullanılan slug kuralını (Türkçe
   karakterleri ASCII'ye indirger, küçük harfe çevirir, boşluk/
   noktalama siler) TEK bir yerde toplar — yeni bir il/ilçe
   sayfası üretilirken veya var olan bir slug doğrulanırken
   bundan başka bir kural KULLANILMAMALIDIR.

   Kullanım:
     const { slugify } = require("./tools/slugify");
     slugify("Emirdağ"); // -> "emirdag"

   Not: Bu betik mevcut URL'leri OTOMATİK DEĞİŞTİRMEZ. Var olan
   bir route'un slug'ı bu kuralla uyuşmuyorsa (örn. eski elle
   yazılmış bir istisna), URL değişikliği ancak 301 redirect ile
   yapılmalı — 404-ROUTE-FIXES.md'de bu tür düzeltmeler kayıtlıdır.
   ============================================================ */
"use strict";

function slugify(input) {
  return String(input || "")
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/Ğ/g, "g").replace(/ğ/g, "g")
    .replace(/Ü/g, "u").replace(/ü/g, "u")
    .replace(/Ş/g, "s").replace(/ş/g, "s")
    .replace(/Ö/g, "o").replace(/ö/g, "o")
    .replace(/Ç/g, "c").replace(/ç/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

module.exports = { slugify };
