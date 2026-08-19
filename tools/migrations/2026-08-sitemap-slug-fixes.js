"use strict";
const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "sitemap.xml");
let xml = fs.readFileSync(p, "utf8");

function line(url) { return `  <url><loc>https://www.namazvakiti.net${url}</loc></url>`; }

// 1) slug düzeltmeleri
xml = xml.replace(line("/afyonkarahisar/emirdagi/"), line("/afyonkarahisar/emirdag/"));
xml = xml.replace(line("/hatay/samandagi/"), line("/hatay/samandag/"));
xml = xml.replace(line("/samsun/tekkeköy/"), line("/samsun/tekkekoy/"));

// 2) 12 sahte merkez satırını sil
const RETIRE = ["denizli", "erzurum", "malatya", "mardin", "mugla", "ordu", "manisa", "tekirdag", "trabzon", "diyarbakir", "kahramanmaras", "van"];
for (const il of RETIRE) {
  xml = xml.replace(line(`/${il}/merkez/`) + "\n", "");
}

// 3) yeni 8 sayfayı doğru il bloğuna, doğru alfabetik konuma ekle
function insertAfter(anchorUrl, newUrl) {
  const anchorLine = line(anchorUrl);
  if (!xml.includes(anchorLine)) throw new Error("anchor not found: " + anchorUrl);
  xml = xml.replace(anchorLine, `${anchorLine}\n${line(newUrl)}`);
}
function insertBefore(anchorUrl, newUrl) {
  const anchorLine = line(anchorUrl);
  if (!xml.includes(anchorLine)) throw new Error("anchor not found: " + anchorUrl);
  xml = xml.replace(anchorLine, `${line(newUrl)}\n${anchorLine}`);
}

insertAfter("/denizli/acipayam/", "/denizli/merkezefendi/");
insertAfter("/erzurum/horasan/", "/erzurum/palandoken/");
insertAfter("/malatya/battalgazi/", "/malatya/yesilyurt/");
insertBefore("/mardin/kiziltepe/", "/mardin/artuklu/");
insertAfter("/mugla/marmaris/", "/mugla/mentese/");
insertBefore("/ordu/fatsa/", "/ordu/altinordu/");
insertAfter("/manisa/soma/", "/manisa/sehzadeler/");
insertAfter("/manisa/turgutlu/", "/manisa/yunusemre/");

fs.writeFileSync(p, xml, "utf8");
console.log("sitemap.xml güncellendi.");
