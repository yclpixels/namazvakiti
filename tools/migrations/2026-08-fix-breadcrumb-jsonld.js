/* Düzeltme: faz2o-breadcrumb-jsonld.js FAQPage script'inin kapanış
   </script> etiketini yanlışlıkla yuttu. Bu betik, iki <script
   type="application/ld+json"> etiketinin arasına eksik </script>'i
   geri ekler. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const dataset = require("./data/turkey-il-ilce.json");

const BROKEN_RE = /(\]\})(<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList")/;

let fixed = 0, alreadyOk = 0, notFound = 0;
function fix(file) {
  let html = fs.readFileSync(file, "utf8");
  if (BROKEN_RE.test(html)) {
    html = html.replace(BROKEN_RE, "$1</script>\n$2");
    fs.writeFileSync(file, html, "utf8");
    fixed++;
  } else if (html.includes('"BreadcrumbList"')) {
    alreadyOk++;
  } else {
    notFound++;
    console.log("UYARI: BreadcrumbList yok ->", file);
  }
}

for (const p of dataset.provinces) {
  fix(path.join(ROOT, `${p.slug}.html`));
  for (const d of p.districts) {
    const distPath = path.join(ROOT, p.slug, d.slug, "index.html");
    if (fs.existsSync(distPath)) fix(distPath);
  }
}
console.log("Düzeltilen:", fixed, "Zaten sağlam:", alreadyOk, "Bulunamadı:", notFound);
