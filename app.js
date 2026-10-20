/* ============================================================
   Namaz Vakti — app.js
   - Diyanet API (ezanvakti.emushaf.net)
   - Geolocation → otomatik il
   - Yakındaki camiler (OpenStreetMap Overpass)
   - Aylık takvim + canlı geri sayım
   ============================================================ */
(function () {
  "use strict";

  const API = "https://ezanvakti.emushaf.net";
  const TURKEY_ID = "2";

  /* Vakit ikonları: assets/icons/nv/ altındaki renkli set, krem karo içinde. */
  const ICO = (name) => `<span class="nv-ico"><img src="/assets/icons/nv/${name}.webp" width="22" height="22" alt="" decoding="async"/></span>`;
  const PRAYERS = [
    { key: "Imsak",  label: "İmsak",  ico: ICO("imsak") },
    { key: "Gunes",  label: "Güneş",  ico: ICO("gunes") },
    { key: "Ogle",   label: "Öğle",   ico: ICO("ogle") },
    { key: "Ikindi", label: "İkindi", ico: ICO("ikindi") },
    { key: "Aksam",  label: "Akşam",  ico: ICO("aksam") },
    { key: "Yatsi",  label: "Yatsı",  ico: ICO("yatsi") },
  ];

  const HIJRI_MONTHS = [
    "Muharrem", "Safer", "Rebiülevvel", "Rebiülahir", "Cemaziyelevvel", "Cemaziyelahir",
    "Recep", "Şaban", "Ramazan", "Şevval", "Zilkade", "Zilhicce",
  ];

  /* Takvimsel hicri ay uzunlukları (1..12). 12. ay artık yılda 30 gün. */
  const HIJRI_MLEN = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
  const HIJRI_LEAP = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];
  const hijriMonthLen = (m, y) =>
    m === 12 && HIJRI_LEAP.indexOf(((y % 30) + 30) % 30) !== -1 ? 30 : HIJRI_MLEN[m - 1];
  /* "Rebiülevvel" ≡ "Rebiulevvel": aksan/şapka farkını yok sayar. */
  const hijriFold = (s) => String(s).toLocaleLowerCase("tr")
    .replace(/ü/g, "u").replace(/ı/g, "i").replace(/î/g, "i").replace(/â/g, "a").replace(/[^a-z]/g, "");
  /* "12 Rebiülevvel 1448" → {d:12, m:3, y:1448}; ayrıştıramazsa null. */
  function parseHijri(txt) {
    const p = String(txt || "").trim().split(/\s+/);
    if (p.length < 2) return null;
    const d = parseInt(p[0], 10);
    const mi = HIJRI_MONTHS.findIndex((n) => hijriFold(n) === hijriFold(p[1]));
    const y = p.length > 2 ? parseInt(p[2], 10) : NaN;
    if (!(d >= 1 && d <= 30) || mi < 0) return null;
    return { d: d, m: mi + 1, y: isFinite(y) ? y : 0 };
  }
  /* 1 Ramazan'a (9. ay) kalan gün. Ramazan içindeysek 0. */
  function daysToRamadan(h) {
    if (h.m === 9) return 0;
    let n = hijriMonthLen(h.m, h.y) - h.d + 1;
    let m = h.m + 1, y = h.y, guard = 0;
    while (m !== 9 && guard++ < 13) {
      if (m > 12) { m = 1; y += 1; continue; }
      n += hijriMonthLen(m, y);
      m += 1;
    }
    return guard >= 13 ? null : n;
  }

  const $ = (id) => document.getElementById(id);
  const els = {
    city: $("citySel"), dist: $("distSel"), err: $("errBox"), note: $("noteBox"),
    cdLabel: $("cdLabel"), cdTime: $("cdTime"), cdSub: $("cdSub"),
    grid: $("prayerGrid"), mosques: $("mosqueList"), mosqueLink: $("mosqueMapLink"),
    dayPrev: $("dayPrev"), dayNext: $("dayNext"), dayLabel: $("dayLabel"), dayReset: $("dayReset"),
    favBtn: $("favToggleBtn"), favList: $("favList"),
    shareBtn: $("shareBtn"), notifBtn: $("notifBtn"), navCd: $("navCd"),
    heroLoc: $("heroLoc"),
    cal: $("calBody"), calMonth: $("calMonth"), calPrint: $("calPrintBtn"), calPrintTitle: $("calPrintTitle"),
    locBtn: $("locBtn"), toast: $("toast"),
    heroHijri: $("heroHijri"), heroFriday: $("heroFriday"),
    ramadanBanner: $("ramadanBanner"), ramSahur: $("ramSahur"), ramIftar: $("ramIftar"),
    qiblaWidget: $("qiblaWidget"),
    qiblaNeedle: $("qiblaNeedle"), qiblaDeg: $("qiblaDeg"), qiblaHint: $("qiblaHint"),
    qiblaPermBtn: $("qiblaPermBtn"),
  };

  const KAABA = { lat: 21.4225, lon: 39.8262 };

  const state = {
    cities: [], districts: [], monthly: [],
    cityId: "", cityName: "", distId: "", distName: "",
    coords: null, tick: null, districtFallbackNote: "", dayOffset: 0,
  };

  /* ── Helpers ── */
  function pad(n) { return String(n).padStart(2, "0"); }
  function todayKey(d = new Date()) {
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  function normTR(s) {
    return (s || "").toLocaleLowerCase("tr")
      .replace(/İ/g, "i").replace(/ı/g, "i").replace(/i̇/g, "i")
      .replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ö/g, "o").replace(/ç/g, "c").trim();
  }
  /* "İSTANBUL" / "ŞEHİTKAMİL" → "İstanbul" / "Şehitkamil" (API büyük harf döner) */
  function titleTR(s) {
    return String(s || "").toLocaleLowerCase("tr")
      .replace(/(^|[\s\-(/])(\S)/g, (m, a, b) => a + b.toLocaleUpperCase("tr"));
  }
  /* Dış kaynaklardan (Diyanet API, OSM Overpass/Nominatim) gelen metinleri
     innerHTML içine güvenli şekilde yazmak için: her yerde kullan. */
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function toast(msg, ms = 2600) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.remove("show"), ms);
  }
  function showErr(msg) {
    els.err.innerHTML = msg ? `<div class="err">${escapeHtml(msg)}</div>` : "";
  }
  /* Hata değil ama kullanıcının bilmesi gereken bir durum (örn. bu ilçe için
     Diyanet ayrı veri yayınlamıyor, il merkezi verisi gösteriliyor). */
  function showNote(msg) {
    if (!els.note) return;
    els.note.innerHTML = msg
      ? `<div class="note-box">${escapeHtml(msg)}</div>`
      : "";
  }

  async function jget(path) {
    const res = await fetch(API + path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sunucu hatası (${res.status})`);
    return res.json();
  }


  /* ── Vakit etiketi (görsel tema artık sabit; sadece metin güncellenir) ── */
  const PRAYER_NAMES = { Imsak:"İMSAK", Gunes:"SABAH", Ogle:"ÖĞLE", Ikindi:"İKİNDİ", Aksam:"AKŞAM", Yatsi:"YATSI" };

  /* ── Ezan bildirimi ────────────────────────────────────────────────
     Tarayıcının yerleşik Notification API'si — kullanıcı açıkça izin
     verirse, seçili il/ilçe için bir vakit girdiğinde sistem bildirimi
     gösterilir. Ses/ezan kaydı bilinçli olarak YOK (telif ve saygınlık
     nedeniyle); yalnızca metin bildirimi. */
  const NOTIF_KEY = "nv_notif_v1";
  function loadNotifPref() {
    try { return localStorage.getItem(NOTIF_KEY) === "1"; } catch { return false; }
  }
  function saveNotifPref(on) {
    try { localStorage.setItem(NOTIF_KEY, on ? "1" : "0"); } catch {}
  }
  let notifLastKey = null; // bu oturumda son bildirilen vakit — ilk tick sessiz başlar
  function notifCheck(activeKey) {
    if (!loadNotifPref() || typeof Notification === "undefined" || Notification.permission !== "granted") {
      notifLastKey = activeKey;
      return;
    }
    if (notifLastKey !== null && activeKey && activeKey !== notifLastKey) {
      const label = PRAYER_NAMES[activeKey] || activeKey;
      try {
        new Notification(`${label} vakti girdi`, {
          body: [state.cityName, state.distName].filter(Boolean).join(" · "),
          icon: "/assets/icons/favicon-32-v2.png",
          tag: "nv-ezan",
        });
      } catch {}
    }
    notifLastKey = activeKey;
  }
  async function toggleNotifications(btn) {
    if (typeof Notification === "undefined") { toast("Tarayıcınız bildirimleri desteklemiyor."); return; }
    if (loadNotifPref()) {
      saveNotifPref(false);
      notifLastKey = null;
      if (btn) btn.classList.remove("is-on");
      toast("Ezan bildirimleri kapatıldı.");
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") {
      try { perm = await Notification.requestPermission(); } catch { perm = "denied"; }
    }
    if (perm !== "granted") { toast("Bildirim izni verilmedi."); return; }
    saveNotifPref(true);
    notifLastKey = null;
    if (btn) btn.classList.add("is-on");
    toast("Ezan bildirimleri açık — vakit girince haber verilecek.");
  }

  /* localStorage tercih ── */
  const PREF = "nv_pref_v2";
  function savePref() {
    try { localStorage.setItem(PREF, JSON.stringify({ cityId: state.cityId, distId: state.distId })); } catch {}
  }
  function loadPref() {
    try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch { return {}; }
  }

  /* ── Favori konumlar — nv_pref_v2'den (son seçilen tek konum) tamamen
     ayrı, kendi versionlanabilir key'i olan bir liste. Giriş gerektirmez. ── */
  const FAV_KEY = "nv_fav_v1";
  function loadFavorites() {
    try {
      const v = JSON.parse(localStorage.getItem(FAV_KEY));
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }
  function saveFavorites(list) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch {}
  }
  function isFavorited(cityId, distId) {
    return loadFavorites().some((f) => f.cityId === cityId && f.distId === distId);
  }
  function toggleFavorite() {
    if (!state.cityId || !state.distId) return;
    const list = loadFavorites();
    const idx = list.findIndex((f) => f.cityId === state.cityId && f.distId === state.distId);
    if (idx >= 0) {
      list.splice(idx, 1);
      toast("Favorilerden kaldırıldı");
    } else {
      list.push({ cityId: state.cityId, cityName: state.cityName, distId: state.distId, distName: state.distName });
      toast("Favorilere eklendi");
    }
    saveFavorites(list);
    renderFavorites();
  }
  function removeFavorite(cityId, distId) {
    saveFavorites(loadFavorites().filter((f) => !(f.cityId === cityId && f.distId === distId)));
    renderFavorites();
  }
  /* Bir favoriye geçiş: mevcut il/ilçe seçim akışıyla birebir aynı yolu
     kullanır (loadDistricts + savePref + loadTimes) — ayrı bir mantık
     icat etmez. loadTimes() zaten state.dayOffset'i 0'a sıfırlıyor. */
  async function selectFavorite(cityId, distId) {
    const city = state.cities.find((c) => c.SehirID === cityId);
    if (!city) { toast("Bu il artık bulunamadı."); return; }
    state.cityId = cityId;
    state.cityName = city.SehirAdi;
    els.city.value = cityId;
    await loadDistricts(cityId, distId);
    state.districtFallbackNote = "";
    showNote("");
    savePref();
    await loadTimes();
    renderFavorites();
  }
  function renderFavorites() {
    if (els.favBtn) {
      const active = isFavorited(state.cityId, state.distId);
      els.favBtn.classList.toggle("active", active);
      const label = active ? "Favorilerden kaldır" : "Favorilere ekle";
      els.favBtn.setAttribute("aria-label", label);
      els.favBtn.title = label;
    }
    if (!els.favList) return;
    const list = loadFavorites();
    if (!list.length) {
      els.favList.innerHTML = `<div class="fav-empty">Henüz kayıtlı konum yok. Yukarıdaki yıldızla bulunduğunuz konumu ekleyin; tek dokunuşla geri dönersiniz.</div>`;
      return;
    }
    els.favList.innerHTML = list.map((f) => `
      <div class="fav-item">
        <button class="fav-select" data-city="${escapeHtml(f.cityId)}" data-dist="${escapeHtml(f.distId)}">
          <span class="fav-name">${escapeHtml(titleTR(f.distName))}, ${escapeHtml(titleTR(f.cityName))}</span>
        </button>
        <button class="fav-remove" data-city="${escapeHtml(f.cityId)}" data-dist="${escapeHtml(f.distId)}" aria-label="Favoriden kaldır" title="Favoriden kaldır">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>`).join("");
  }

  /* ── Şehirler ── */
  async function loadCities() {
    const cities = await jget(`/sehirler/${TURKEY_ID}`);
    state.cities = cities;
    els.city.textContent = "";
    for (const c of cities) {
      const opt = document.createElement("option");
      opt.value = c.SehirID;
      opt.textContent = titleTR(c.SehirAdi);
      els.city.appendChild(opt);
    }
  }

  async function loadDistricts(cityId, preferDistId) {
    const districts = await jget(`/ilceler/${cityId}`);
    state.districts = districts;
    els.dist.textContent = "";
    for (const d of districts) {
      const opt = document.createElement("option");
      opt.value = d.IlceID;
      opt.textContent = titleTR(d.IlceAdi);
      els.dist.appendChild(opt);
    }

    let pick = preferDistId && districts.find((d) => d.IlceID === preferDistId);
    /* İl seçilince il merkezi: Diyanet büyükşehirlerde merkezi noktayı il
       adıyla ("ANKARA"), diğerlerinde "MERKEZ" diye yayınlıyor. Alfabetik
       ilk ilçeye (ör. Ankara → Akyurt) ancak ikisi de yoksa düşülür. */
    if (!pick) pick = districts.find((d) => normTR(d.IlceAdi) === normTR(state.cityName))
      || districts.find((d) => normTR(d.IlceAdi) === "merkez") || districts[0];
    state.distId = pick.IlceID;
    state.distName = pick.IlceAdi;
    els.dist.value = pick.IlceID;
  }

  /* ── Vakitler ── */
  async function loadTimes() {
    showErr("");
    if (!state.districtFallbackNote) showNote("");
    try {
      const monthly = await jget(`/vakitler/${state.distId}`);
      state.monthly = monthly;
      state.dayOffset = 0;
      renderCalendar();
      renderTrendChart();
      startCountdown();
      renderWeatherTile();
    } catch (e) {
      showErr(e.message || "Vakitler alınamadı.");
    }
  }

  /* ── Geri sayım + bugünün vakitleri ── */
  function getToday() {
    const key = todayKey();
    return state.monthly.find((r) => r.MiladiTarihKisa === key) || null;
  }
  function getTomorrow() {
    const idx = state.monthly.findIndex((r) => r.MiladiTarihKisa === todayKey());
    return idx >= 0 ? state.monthly[idx + 1] : null;
  }
  /* Günlük navigasyon: bugüne göre ±offset gündeki kaydı döndürür (0 = bugün).
     Ek bir API çağrısı gerektirmez — zaten çekilmiş olan aylık veriden okur. */
  function getDayRecord(offset) {
    const idx = state.monthly.findIndex((r) => r.MiladiTarihKisa === todayKey());
    if (idx < 0) return null;
    return state.monthly[idx + offset] || null;
  }
  function dayLabelFor(offset, rec) {
    if (offset === 0) return "Bugün";
    if (offset === 1) return "Yarın";
    if (offset === -1) return "Dün";
    if (!rec) return "";
    const dayName = rec.MiladiTarihUzunIso8601
      ? new Date(rec.MiladiTarihUzunIso8601).toLocaleDateString("tr-TR", { weekday: "long" })
      : "";
    const dateShort = rec.MiladiTarihKisa ? rec.MiladiTarihKisa.slice(0, 5) : "";
    return dayName ? `${dayName} · ${dateShort}` : dateShort;
  }
  function asDate(base, hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0);
  }

  function startCountdown() {
    if (state.tick) clearInterval(state.tick);
    renderGridAndCountdown();
    state.tick = setInterval(renderGridAndCountdown, 1000);
  }

  function renderGridAndCountdown() {
    const today = getToday();
    if (!today) {
      els.grid.innerHTML = "";
      renderPrayerGrid._sig = "";
      els.cdSub.textContent = "Bugün için vakit bulunamadı.";
      navSync(null, "");
      return;
    }
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const list = PRAYERS.map((p) => ({
      ...p, time: today[p.key], dt: asDate(base, today[p.key]),
    }));

    let next = list.find((p) => p.dt > now);
    if (!next) {
      const t = getTomorrow();
      if (t) {
        const tb = new Date(base.getTime() + 86400000);
        next = { key: "Imsak", label: "İmsak", time: t.Imsak, dt: asDate(tb, t.Imsak) };
      }
    }

    // Şu anki aktif vakit (en son geçen)
    let current = null;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].dt <= now) { current = list[i]; break; }
    }
    /* Gece yarısı ile imsak arasında bugünün hiçbir vakti henüz girmemiştir
       (current === null). Fiilen devam eden vakit, dün akşam giren yatsıdır —
       imsak ise henüz GELMEMİŞ vakittir. Şeritteki "ŞU AN …" göstergesiyle
       aynı kural. */
    const activeKey = current ? current.key : "Yatsi";
    notifCheck(activeKey);

    renderPrayerGrid(next, current, now);

    // Geri sayım — başlığın ikinci satırı: "Akşam ezanına 00:45:12"
    let cdText = "--:--:--";
    const place = placeLabel();
    if (next) {
      const diff = next.dt - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      cdText = `${pad(h)}:${pad(m)}:${pad(s)}`;
      const lbl = `${next.label} ezanına`;
      if (els.cdLabel.textContent !== lbl) els.cdLabel.textContent = lbl;
      els.cdTime.textContent = cdText;
      const sub = `${place.long} için sıradaki vakit ${next.label.toLocaleLowerCase("tr")}, saat ${next.time}. Vakitler Diyanet İşleri Başkanlığı verisidir.`;
      if (els.cdSub.textContent !== sub) els.cdSub.textContent = sub;
    }
    if (els.heroLoc && els.heroLoc.textContent !== place.short) els.heroLoc.textContent = place.short;
    navSync(next, cdText);

    // Hicri tarih — API'nin uzun alanını (ay adı yazılı) doğrudan göster, format tahmini yok
    const hijriLong = today.HicriTarihUzun || today.HijriTarihUzun || "";
    if (hijriLong) {
      // "16 Muharrem 1448" gibi; yıl kısmını kırpıp kartta göster
      if (els.heroHijri) els.heroHijri.textContent = hijriLong;
    } else {
      const hijriShort = today.HicriTarihKisa || today.HijriTarihKisa || "";
      if (hijriShort && els.heroHijri) els.heroHijri.textContent = hijriShort;
    }

    // Ramazan — SADECE ay adının yazılı olduğu alanda "ramazan" geçiyorsa (yanlış pozitif imkânsız)
    const isRamadan = /ramazan/i.test(hijriLong);
    if (els.ramadanBanner) els.ramadanBanner.hidden = !isRamadan;
    renderRamadanCountdown(hijriLong, isRamadan);
    if (isRamadan) {
      if (els.ramSahur) els.ramSahur.textContent = today.Imsak;
      if (els.ramIftar) els.ramIftar.textContent = today.Aksam;
    }

    // Cuma günü rozeti
    const isFriday = now.getDay() === 5;
    if (els.heroFriday) els.heroFriday.hidden = !isFriday;
  }

  /* ── Günlük vakit kartları (Bugün / ‹ Önceki Gün / Sonraki Gün ›) ──
     "Sıradaki vakit" geri sayımı her zaman gerçek "şu an"a bağlı kalır
     (yukarıda, değişmedi); bu fonksiyon sadece hangi GÜNÜN 6 vaktinin
     kart olarak gösterildiğini seçer. `liveNext`, sadece bugün görüntülenirken
     aktif-vakit vurgusu için kullanılır. */
  /* "2 saat 14 dk" / "43 dk" — mevcut vakit verisinden türetilir. */
  function remainText(ms) {
    const m = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(m / 60), mm = m % 60;
    return (h ? h + " saat " + mm + " dk" : mm + " dk") + " kaldı";
  }

  function renderPrayerGrid(liveNext, current, now) {
    const rec = getDayRecord(state.dayOffset);
    if (!rec) {
      els.grid.innerHTML = "";
      renderPrayerGrid._sig = "";
      updateDayNav(null);
      return;
    }
    const isToday = state.dayOffset === 0;
    /* Ana vurgu artık ŞU ANKİ vakit (şeritteki "ŞU AN …" ile birebir aynı
       kural). Sıradaki vakit hero'daki geri sayımda zaten yaşıyor. */
    const nowKey = isToday ? (current ? current.key : "") : "";
    const nextKey = isToday && liveNext ? liveNext.key : "";

    /* Kalan süreler dakikada bir değişir → imza dakika hassasiyetinde.
       (Eskiden saniyede bir render vardı; bu hâlâ 60 kat daha az.) */
    const minKey = isToday && now ? Math.floor(now.getTime() / 60000) : 0;
    const gridSig = [state.distId, state.dayOffset, rec.MiladiTarihKisa, nowKey, nextKey, minKey,
      PRAYERS.map((p) => rec[p.key]).join(",")].join("|");
    if (gridSig === renderPrayerGrid._sig && els.grid.childElementCount) {
      updateDayNav(rec);
      return;
    }
    renderPrayerGrid._sig = gridSig;

    const base = now ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : null;
    /* Her sütunun üst çizgisi (mobilde sol çizgisi) günün akışını gösterir:
       geçmiş vakit = dolu, şu anki vakit = sonraki vakte kadar geçen kesir. */
    const segOf = (i) => {
      if (!isToday || !base) return 0;
      const start = asDate(base, rec[PRAYERS[i].key]);
      if (start > now) return 0;
      let end = i + 1 < PRAYERS.length ? asDate(base, rec[PRAYERS[i + 1].key]) : null;
      if (!end) {
        const t = getTomorrow();
        end = t ? asDate(new Date(base.getTime() + 86400000), t.Imsak) : new Date(base.getTime() + 86400000);
      }
      return Math.max(0, Math.min(1, (now - start) / (end - start)));
    };
    els.grid.innerHTML = PRAYERS.map((p, i) => {
      const isNow = nowKey === p.key;
      const isNext = nextKey === p.key;
      let cls = "lx-t", sub = "";
      const seg = segOf(i);
      if (isNow) { cls += " is-now"; sub = "Şu an"; }
      else if (isToday && base) {
        const dt = asDate(base, rec[p.key]);
        if (dt > now) sub = remainText(dt - now);
        if (isNext) cls += " is-next";
      }
      if (isToday && !isNow && !sub) cls += " is-past";
      return `<div class="${cls}" data-prayer="${p.key}" tabindex="-1" style="--seg:${seg.toFixed(4)}">
        <span class="lx-t-dot" aria-hidden="true"></span>${isNow ? '<span class="lx-t-now" aria-hidden="true"></span>' : ""}
        <div class="lx-t-name">${p.ico}${escapeHtml(p.label)}</div>
        <div class="lx-t-time">${escapeHtml(rec[p.key])}</div>
        <div class="lx-t-sub">${escapeHtml(sub)}</div>
      </div>`;
    }).join("");
    updateDayNav(rec);
  }

  function updateDayNav(rec) {
    if (els.dayLabel) els.dayLabel.textContent = dayLabelFor(state.dayOffset, rec);
    if (els.dayPrev) els.dayPrev.disabled = !getDayRecord(state.dayOffset - 1);
    if (els.dayNext) els.dayNext.disabled = !getDayRecord(state.dayOffset + 1);
    if (els.dayReset) els.dayReset.hidden = state.dayOffset === 0;
  }

  function changeDay(delta) {
    if (!getDayRecord(state.dayOffset + delta)) return;
    state.dayOffset += delta;
    renderGridAndCountdown();
  }

  /* ── Paylaş — o an EKRANDA GÖRÜNEN günün (dayOffset) vakitlerini paylaşır,
     kullanıcıyı zorla Bugün'e döndürmez. */
  function buildShareText() {
    const rec = getDayRecord(state.dayOffset);
    if (!rec || !state.cityName || !state.distName) return null;
    const dateLabel = rec.MiladiTarihUzun || rec.MiladiTarihKisa || "";
    const canonical = document.querySelector('link[rel="canonical"]');
    const url = (canonical && canonical.href) || location.href;
    return [
      `${state.cityName} / ${state.distName} namaz vakitleri — ${dateLabel}`,
      "",
      `İmsak: ${rec.Imsak}`,
      `Güneş: ${rec.Gunes}`,
      `Öğle: ${rec.Ogle}`,
      `İkindi: ${rec.Ikindi}`,
      `Akşam: ${rec.Aksam}`,
      `Yatsı: ${rec.Yatsi}`,
      "",
      url,
    ].join("\n");
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (e) { reject(e); }
    });
  }

  async function shareTimes() {
    const text = buildShareText();
    if (!text) { toast("Paylaşılacak vakit bulunamadı."); return; }
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (e) {
        if (e && e.name !== "AbortError") toast("Paylaşım başarısız oldu.");
      }
      return;
    }
    try {
      await copyToClipboard(text);
      toast("Vakitler panoya kopyalandı");
    } catch {
      toast("Kopyalama desteklenmiyor.");
    }
  }

  /* ── Aylık takvim (varsayılan 7 gün, "tümünü gör" ile genişler) ── */
  let calExpanded = false;
  function renderCalendar() {
    const key = todayKey();
    const idx = state.monthly.findIndex((r) => r.MiladiTarihKisa === key);
    const start = Math.max(0, idx);
    const visibleCount = calExpanded ? 30 : 7;
    const slice = state.monthly.slice(start, start + visibleCount);
    const hasMore = state.monthly.length > start + 7;

    if (state.monthly[start]) {
      const d = state.monthly[start];
      const month = (d.MiladiTarihUzun || "").split(" ").slice(1, 3).join(" ")
        || new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
      els.calMonth.textContent = month ? " · " + month : "";
    }

    const rows = slice.map((r) => {
      const isToday = r.MiladiTarihKisa === key;
      const dayName = r.MiladiTarihUzunIso8601
        ? new Date(r.MiladiTarihUzunIso8601).toLocaleDateString("tr-TR", { weekday: "long" })
        : "";
      const dateShort = r.MiladiTarihKisa ? r.MiladiTarihKisa.slice(0, 5).replace(".", " ") : "";
      const label = isToday ? "Bugün" : (dayName || dateShort);
      return `<div class="cal-row ${isToday ? "today" : ""}">
        <div>
          <div class="cal-day">${escapeHtml(label)}</div>
          <div class="cal-date">${escapeHtml(r.MiladiTarihKisa || "")}</div>
        </div>
        <span class="cal-cell">${escapeHtml(r.Imsak)}</span>
        <span class="cal-cell">${escapeHtml(r.Gunes)}</span>
        <span class="cal-cell">${escapeHtml(r.Ogle)}</span>
        <span class="cal-cell">${escapeHtml(r.Ikindi)}</span>
        <span class="cal-cell">${escapeHtml(r.Aksam)}</span>
        <span class="cal-cell">${escapeHtml(r.Yatsi)}</span>
      </div>`;
    }).join("");

    const toggleBtn = hasMore || calExpanded
      ? `<button class="cal-toggle" id="calToggleBtn">${calExpanded ? "Daha az göster" : "30 günün tamamını göster"}</button>`
      : "";

    els.cal.innerHTML = rows + toggleBtn;

    const btn = document.getElementById("calToggleBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        calExpanded = !calExpanded;
        renderCalendar();
        if (!calExpanded) els.cal.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }

  /* ── Mevsimsel trend — zaten çekilmiş aylık veriden türetilir, ek istek
     atılmaz. İmsak-Yatsı aralığının ay içinde nasıl uzayıp kısaldığını
     gösterir (astronomik gün uzunluğu değil — imsak güneşten önce, yatsı
     akşam ezanından sonra olduğu için bu aralık gerçek gün ışığından
     daha geniştir; etiket bunu netleştirir). */
  function timeToMin(hhmm) {
    const p = String(hhmm || "").split(":");
    const h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  }
  function renderTrendChart() {
    const host = document.getElementById("nvTrend");
    if (!host) return;
    const rows = state.monthly.filter((r) => r.Imsak && r.Yatsi);
    const spans = rows.map((r) => timeToMin(r.Yatsi) - timeToMin(r.Imsak));
    if (rows.length < 6 || spans.some((v) => !Number.isFinite(v))) { host.innerHTML = ""; return; }

    const min = Math.min(...spans), max = Math.max(...spans);
    const W = 600, H = 90, EDGE = 6;
    const n = spans.length;
    const pts = spans.map((v, i) => {
      const x = EDGE + (i / (n - 1)) * (W - EDGE * 2);
      const y = max === min ? H / 2 : H - EDGE - ((v - min) / (max - min)) * (H - EDGE * 2);
      return [x, y];
    });
    const line = pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const areaPath = "M" + pts[0][0].toFixed(1) + "," + H + " L" + line.split(" ").join(" L") +
      " L" + pts[n - 1][0].toFixed(1) + "," + H + " Z";
    const todayIdx = rows.findIndex((r) => r.MiladiTarihKisa === todayKey());
    const fmtSpan = (mins) => Math.floor(mins / 60) + "sa " + pad(mins % 60) + "dk";
    const trend = spans[n - 1] - spans[0];
    const trendTxt = trend > 2 ? "uzuyor" : trend < -2 ? "kısalıyor" : "sabit";

    host.innerHTML =
      '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" style="width:100%;height:88px;" aria-hidden="true">' +
        '<defs><linearGradient id="nvTrendG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c87f2" stop-opacity=".28"/><stop offset="1" stop-color="#7c87f2" stop-opacity="0"/></linearGradient></defs>' +
        '<path d="' + areaPath + '" fill="url(#nvTrendG)"/>' +
        '<polyline points="' + line + '" fill="none" stroke="#a5adff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>' +
      "</svg>" +
      '<div class="lx-trend-meta">' +
        "<span>Bugün <b>" + escapeHtml(fmtSpan(spans[todayIdx >= 0 ? todayIdx : 0])) + "</b></span>" +
        "<span>Bu ay " + trendTxt + "</span>" +
      "</div>";
  }

  /* ── Günün Ayeti ──────────────────────────────────────────────────
     Metin ASLA ezberden yazılmaz: api.alquran.cloud'un Diyanet İşleri
     Başkanlığı meali baskısından (tr.diyanet) canlı çekilir. Referans
     listesi sadece sure:ayet numaralarını içerir — çeviri metni her
     zaman kaynaktan gelir. Gün-bazlı sabit seçim: herkes aynı gün aynı
     ayeti görür, günde bir kez değişir. Sonuç o günün tarihiyle birlikte
     localStorage'da tutulur, sayfa/vakit değişse de tekrar istek atılmaz. */
  const DAILY_VERSES = [
    { s: 94, a: 5, name: "İnşirah" }, { s: 94, a: 6, name: "İnşirah" },
    { s: 2, a: 286, name: "Bakara" }, { s: 65, a: 3, name: "Talak" },
    { s: 13, a: 28, name: "Ra'd" }, { s: 39, a: 53, name: "Zümer" },
    { s: 2, a: 153, name: "Bakara" }, { s: 16, a: 97, name: "Nahl" },
    { s: 55, a: 60, name: "Rahman" }, { s: 3, a: 159, name: "Al-i İmran" },
    { s: 9, a: 40, name: "Tevbe" }, { s: 20, a: 25, name: "Taha" },
    { s: 3, a: 139, name: "Al-i İmran" }, { s: 29, a: 69, name: "Ankebut" },
    { s: 2, a: 152, name: "Bakara" }, { s: 49, a: 13, name: "Hucurat" },
  ];
  const VERSE_KEY = "nv_verse_v1";
  function dayOfYear(d) {
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  }
  async function renderDailyVerse() {
    const panel = document.getElementById("nvVerse");
    if (!panel) return;
    const todayIso = todayKey();
    try {
      const cached = JSON.parse(localStorage.getItem(VERSE_KEY) || "null");
      if (cached && cached.date === todayIso && cached.text) { paintVerse(cached); return; }
    } catch {}

    const pick = DAILY_VERSES[dayOfYear(new Date()) % DAILY_VERSES.length];
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/ayah/${pick.s}:${pick.a}/tr.diyanet`, { cache: "no-store" });
      if (!res.ok) throw new Error("Sunucu hatası");
      const j = await res.json();
      const text = j && j.data && j.data.text;
      if (!text) throw new Error("Ayet metni alınamadı");
      const data = { date: todayIso, text, sura: pick.name, suraNo: pick.s, ayahNo: pick.a };
      try { localStorage.setItem(VERSE_KEY, JSON.stringify(data)); } catch {}
      paintVerse(data);
    } catch {
      /* Kaynak yoksa bölüm hiç görünmez — uydurma/yer tutucu metin yok */
      const sec = panel.closest("section");
      if (sec) sec.hidden = true;
    }
  }
  function paintVerse(d) {
    const panel = document.getElementById("nvVerse");
    if (!panel) return;
    panel.innerHTML =
      '<p class="lx-quote' + (d.text.length > 200 ? " lx-quote--long" : "") + '">' + escapeHtml(d.text) + "</p>" +
      '<p class="lx-quote-src"><b>' + escapeHtml(d.sura) + " Suresi, " + escapeHtml(d.ayahNo) +
      ". ayet</b> · Diyanet İşleri Başkanlığı meali</p>";
  }

  /* ── Yakındaki camiler (Overpass / OpenStreetMap) ── */
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function fmtDist(m) {
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  }
  function walkMin(m) {
    return `${Math.max(1, Math.round(m / 80))} dk yürüme`;
  }

  async function loadNearbyMosques(lat, lon) {
    els.mosques.innerHTML = `<div class="mosque-empty">Yakındaki camiler aranıyor…</div>`;
    const query = `[out:json][timeout:20];(
      node["amenity"="place_of_worship"]["religion"="muslim"](around:2500,${lat},${lon});
      way["amenity"="place_of_worship"]["religion"="muslim"](around:2500,${lat},${lon});
    );out center 30;`;

    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
      });
      const data = await res.json();
      let items = (data.elements || []).map((el) => {
        const la = el.lat || (el.center && el.center.lat);
        const lo = el.lon || (el.center && el.center.lon);
        const name = (el.tags && (el.tags.name || el.tags["name:tr"])) || "Cami";
        return { name, lat: la, lon: lo, dist: haversine(lat, lon, la, lo) };
      }).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lon));

      // benzersiz + sıralı
      const seen = new Set();
      items = items.filter((m) => {
        const k = m.name + Math.round(m.dist);
        if (seen.has(k)) return false; seen.add(k); return true;
      }).sort((a, b) => a.dist - b.dist).slice(0, 6);

      if (!items.length) {
        els.mosques.innerHTML = `<div class="mosque-empty">Yakında cami bulunamadı.</div>`;
        return;
      }

      els.mosques.innerHTML = items.map((m) => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(m.lat)},${encodeURIComponent(m.lon)}`;
        return `<a class="mosque" href="${escapeHtml(url)}" target="_blank" rel="noopener">
          <div class="mosque-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h16M5 21v-6.5c0-1 .6-1.8 1.5-2.3L9 11v-2a3 3 0 0 1 6 0v2l2.5 1.2c.9.5 1.5 1.3 1.5 2.3V21M12 6V3M10.5 4.5h3"/></svg></div>
          <div class="mosque-info">
            <div class="mosque-name">${escapeHtml(m.name)}</div>
            <div class="mosque-area">Yol tarifi için dokun</div>
          </div>
          <div class="mosque-dist">
            <div class="mosque-km">${escapeHtml(fmtDist(m.dist))}</div>
            <div class="mosque-walk">${escapeHtml(walkMin(m.dist))}</div>
          </div>
        </a>`;
      }).join("");
    } catch (e) {
      els.mosques.innerHTML = `<div class="mosque-empty">Camiler şu an yüklenemedi.</div>`;
    }
  }

  /* ── Kıble Pusulası ── */
  function qiblaBearing(lat, lon) {
    const toRad = (x) => (x * Math.PI) / 180;
    const toDeg = (x) => (x * 180) / Math.PI;
    const lat1 = toRad(lat), lat2 = toRad(KAABA.lat);
    const dLon = toRad(KAABA.lon - lon);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
  }

  function compassDirName(deg) {
    const names = ["Kuzey", "Kuzeydoğu", "Doğu", "Güneydoğu", "Güney", "Güneybatı", "Batı", "Kuzeybatı"];
    return names[Math.round(deg / 45) % 8];
  }

  let qiblaAngle = null;
  let qiblaOrientationActive = false;

  function onDeviceOrientation(e) {
    if (qiblaAngle === null) return;
    let heading = null;
    if (typeof e.webkitCompassHeading === "number") {
      heading = e.webkitCompassHeading;
    } else if (e.absolute && typeof e.alpha === "number") {
      heading = 360 - e.alpha;
    }
    if (heading === null) return;
    const needleRotation = qiblaAngle - heading;
    if (els.qiblaNeedle) els.qiblaNeedle.style.transform = `translate(-50%,-100%) rotate(${needleRotation}deg)`;
  }

  function startCompassListening() {
    if (qiblaOrientationActive) return;
    qiblaOrientationActive = true;
    if (typeof DeviceOrientationEvent !== "undefined" && "ondeviceorientationabsolute" in window) {
      window.addEventListener("deviceorientationabsolute", onDeviceOrientation, true);
    } else {
      window.addEventListener("deviceorientation", onDeviceOrientation, true);
    }
  }

  async function findQibla() {
    if (!navigator.geolocation) { toast("Tarayıcınız konumu desteklemiyor."); return; }
    if (els.qiblaHint) els.qiblaHint.textContent = "Konum alınıyor…";

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      qiblaAngle = qiblaBearing(lat, lon);
      const dirName = compassDirName(qiblaAngle);

      if (els.qiblaDeg) els.qiblaDeg.textContent = `${Math.round(qiblaAngle)}°`;
      if (els.qiblaNeedle) els.qiblaNeedle.style.transform = `translate(-50%,-100%) rotate(${qiblaAngle}deg)`;

      // iOS 13+ hareket sensörü izni
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") {
        if (els.qiblaHint) {
          els.qiblaHint.innerHTML = `Kıble yönü kuzeyden <b>${Math.round(qiblaAngle)}°</b> (${dirName}). Pusulayı canlı döndürmek için izin gerekir.`;
        }
        if (els.qiblaPermBtn) {
          els.qiblaPermBtn.textContent = "Pusulayı etkinleştir";
          els.qiblaPermBtn.onclick = async () => {
            try {
              const res = await DOE.requestPermission();
              if (res === "granted") { startCompassListening(); toast("Pusula etkin"); }
              else { toast("Pusula izni verilmedi."); }
            } catch { toast("Pusula başlatılamadı."); }
          };
        }
      } else {
        if (els.qiblaHint) {
          els.qiblaHint.innerHTML = `Kıble yönü kuzeyden <b>${Math.round(qiblaAngle)}°</b> (${dirName}). Telefonunuzu düz tutup döndürün.`;
        }
        if (els.qiblaPermBtn) els.qiblaPermBtn.style.display = "none";
        startCompassListening();
      }
    }, () => {
      if (els.qiblaHint) els.qiblaHint.textContent = "Konum alınamadı. Tarayıcı ayarlarından izin verin.";
      toast("Konum alınamadı.");
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  /* ── Konumdan il seç ── */
  async function locateAndSelect() {
    if (!navigator.geolocation) { toast("Tarayıcınız konumu desteklemiyor."); return; }
    els.locBtn.classList.add("loading");
    toast("Konum alınıyor…");

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      state.coords = { lat, lon };
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=tr`
        );
        const data = await r.json();
        const prov = (data.address && (data.address.province || data.address.state || data.address.city)) || "";
        const norm = normTR(prov);
        let match = state.cities.find((c) => normTR(c.SehirAdi) === norm)
          || state.cities.find((c) => norm.includes(normTR(c.SehirAdi)));
        if (match) {
          els.city.value = match.SehirID;
          await onCityChange(match.SehirID);
          toast(`${match.SehirAdi} seçildi`);
        } else {
          toast("İl eşleştirilemedi, elle seçebilirsiniz.");
        }
      } catch {
        toast("Konum çözümlenemedi.");
      }
      // camileri her durumda göster
      loadNearbyMosques(lat, lon);
      els.locBtn.classList.remove("loading");
    }, (err) => {
      els.locBtn.classList.remove("loading");
      toast(err.code === 1 ? "Konum izni verilmedi." : "Konum alınamadı.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  /* ── Olaylar ── */
  async function onCityChange(cityId) {
    const city = state.cities.find((c) => c.SehirID === cityId);
    if (!city) return;
    state.cityId = cityId;
    state.cityName = city.SehirAdi;
    await loadDistricts(cityId);
    state.districtFallbackNote = "";
    showNote("");
    savePref();
    await loadTimes();
    renderFavorites();
  }

  async function onDistChange(distId) {
    const d = state.districts.find((x) => x.IlceID === distId);
    if (!d) return;
    state.distId = distId;
    state.distName = d.IlceAdi;
    state.districtFallbackNote = "";
    showNote("");
    savePref();
    await loadTimes();
    renderFavorites();
  }

  /* ── Başlat ── */
  async function init() {
    lxSetup();
    try {
      await loadCities();
      // Sayfa belirli bir il/ilçe icin mi? (il ve ilçe sayfaları body'de data-city taşır)
      const pageCity = (document.body.dataset.city || "").trim();
      const pageDist = (document.body.dataset.district || "").trim();
      const pref = loadPref();
      let cityId = null;

      if (pageCity) {
        const match = state.cities.find((c) => normTR(c.SehirAdi) === normTR(pageCity));
        if (match) cityId = match.SehirID;
      }
      if (!cityId) cityId = pref.cityId;
      if (!cityId || !state.cities.find((c) => c.SehirID === cityId)) {
        const ist = state.cities.find((c) => normTR(c.SehirAdi) === "istanbul");
        cityId = ist ? ist.SehirID : state.cities[0].SehirID;
      }
      els.city.value = cityId;
      const city = state.cities.find((c) => c.SehirID === cityId);
      state.cityId = cityId; state.cityName = city.SehirAdi;

      // İl sayfasındaysak localStorage'daki ilçe tercihi degil, o ilin merkezi/ilcesi
      const preferDist = pageCity ? null : pref.distId;
      await loadDistricts(cityId, preferDist);
      state.districtFallbackNote = "";
      if (pageDist) {
        // 1) Tam eşleşme (Diyanet'te bu ilçe adı birebir var mı?)
        let dm = state.districts.find((d) => normTR(d.IlceAdi) === normTR(pageDist));
        // 2) Diyanet, büyük il merkezlerinde (İstanbul/Ankara/İzmir vb.) ilçe bazında değil,
        //    "il adını taşıyan" tek bir merkezi nokta üzerinden vakit veriyor (örn. İstanbul
        //    listesinde "İSTANBUL" diye bir "ilçe" var — Fatih/Kadıköy/Şişli gibi merkezi
        //    ilçeler ayrı yayınlanmıyor). Böyle bir durumda o merkezi noktayı kullan, ama
        //    kullanıcıyı bunun bir yaklaşık değer olduğu konusunda bilgilendir.
        let usedFallback = false;
        if (!dm) {
          dm = state.districts.find((d) => normTR(d.IlceAdi) === normTR(city.SehirAdi));
          if (!dm) dm = state.districts.find((d) => normTR(d.IlceAdi) === "merkez");
          if (dm) usedFallback = true;
        }
        if (dm) {
          state.distId = dm.IlceID;
          state.distName = pageDist; // sayfanın konusu (H1/başlık) hep [İlçe] olarak kalır
          els.dist.value = dm.IlceID;
          if (usedFallback) {
            state.districtFallbackNote = `Diyanet, ${pageDist} için ayrı vakit yayınlamıyor; ${titleTR(city.SehirAdi)} geneli için hesaplanan merkezi vakitler gösteriliyor.`;
          }
        } else {
          // 3) Hiçbir eşleşme yok — yanlış ilçenin verisini göstermek yerine
          //    açıkça "veri yok" durumunu göster.
          state.distId = "";
          state.distName = pageDist;
        }
      }
      els.city.value = cityId;
      if (state.districtFallbackNote) showNote(state.districtFallbackNote);
      if (pageDist && !state.distId) {
        showErr(`${pageDist} için namaz vakti verisi şu anda bulunamadı.`);
        if (els.heroLoc) els.heroLoc.textContent = `${state.cityName} · ${pageDist}`;
      } else {
        await loadTimes();
      }
    } catch (e) {
      showErr(e.message || "Veriler yüklenemedi. Bağlantınızı kontrol edin.");
    }
    renderFavorites();

    els.city.addEventListener("change", (e) => onCityChange(e.target.value));
    els.dist.addEventListener("change", (e) => onDistChange(e.target.value));
    els.locBtn.addEventListener("click", locateAndSelect);
    if (els.dayPrev) els.dayPrev.addEventListener("click", () => changeDay(-1));
    if (els.dayNext) els.dayNext.addEventListener("click", () => changeDay(1));
    if (els.dayReset) els.dayReset.addEventListener("click", () => changeDay(-state.dayOffset));
    if (els.favBtn) els.favBtn.addEventListener("click", toggleFavorite);
    if (els.shareBtn) els.shareBtn.addEventListener("click", shareTimes);
    if (els.favList) els.favList.addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".fav-remove");
      if (removeBtn) { removeFavorite(removeBtn.dataset.city, removeBtn.dataset.dist); return; }
      const selectBtn = e.target.closest(".fav-select");
      if (selectBtn) selectFavorite(selectBtn.dataset.city, selectBtn.dataset.dist);
    });
    if (els.qiblaPermBtn) els.qiblaPermBtn.addEventListener("click", findQibla);
    els.mosqueLink.addEventListener("click", () => {
      if (state.coords) {
        window.open(`https://www.google.com/maps/search/cami/@${state.coords.lat},${state.coords.lon},15z`, "_blank");
      } else {
        toast("Önce konum izni verin.");
        locateAndSelect();
      }
    });
  }

  /* ══ Sayfa düzeni ════════════════════════════════════════════════════
     İskelet artık statik HTML'de (tools/migrations/2026-10-linear-redesign.js);
     burada sadece davranış bağlanır: menüdeki geri sayım, bildirim/yazdır
     düğmeleri, hava durumu ve reklam yuvaları. */

  /* Başlıkta gösterilen konum: ilçe sayfasında ilçe, il merkezinde il adı */
  function placeLabel() {
    const city = titleTR(state.cityName);
    const dist = titleTR(state.distName);
    if (!dist || normTR(dist) === normTR(city) || normTR(dist) === "merkez") return { short: city || "—", long: city };
    return { short: dist, long: `${dist}, ${city}` };
  }

  /* Hero ekrandan çıkınca menüde küçük bir geri sayım belirir */
  function navSync(next, cdText) {
    if (!els.navCd) return;
    const html = next ? `<i></i>${escapeHtml(next.label)} <b>${escapeHtml(cdText)}</b>` : "";
    if (navSync._h !== html) { navSync._h = html; els.navCd.innerHTML = html; }
  }

  function lxSetup() {
    const nav = document.querySelector(".lx-nav");
    const title = document.querySelector(".lx-title");
    if (nav && title && "IntersectionObserver" in window) {
      new IntersectionObserver((ents) => nav.classList.toggle("is-scrolled", !ents[0].isIntersecting),
        { rootMargin: "-64px 0px 0px 0px" }).observe(title);
    }

    if (els.notifBtn) {
      if (loadNotifPref() && typeof Notification !== "undefined" && Notification.permission === "granted") {
        els.notifBtn.classList.add("is-on");
      }
      els.notifBtn.addEventListener("click", () => toggleNotifications(els.notifBtn));
    }

    if (els.calPrint) els.calPrint.addEventListener("click", () => {
      if (els.calPrintTitle) els.calPrintTitle.textContent = placeLabel().long + " — İmsakiye";
      calExpanded = true;
      renderCalendar();
      window.print();
    });

    // ☰ menü Escape ile kapanır
    document.addEventListener("keydown", (e) => {
      const m = document.querySelector(".lx-menu[open]");
      if (e.key === "Escape" && m) { m.open = false; m.querySelector("summary").focus(); }
    });

    // Boş durumlardaki "Konumumu kullan" düğmeleri
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-locate]")) locateAndSelect();
    });

    /* Reklamlar: içerik ile footer arasında yatay bant; çok geniş ekranda
       (≥1560px) içerik kolonunun iki yanında sabit dikey birimler. */
    const foot = document.querySelector(".lx-foot");
    if (foot) foot.parentNode.insertBefore(nvAdSlot("bar"), foot);
    ["l", "r"].forEach((side) => {
      const ad = nvAdSlot("side");
      ad.classList.add("is-" + side);
      document.body.appendChild(ad);
    });

    renderDailyVerse();
  }

  /* ── Reklam yuvaları ──
     Doldurulamayan (onay bekleyen/envanter yok) slotlar kırık kutu
     göstermek yerine tamamen gizlenir. */
  const AD_CLIENT = "ca-pub-4283080394775837";
  const AD_SLOT = "7676950354";
  let adsenseScriptRequested = false;
  function ensureAdSenseScript() {
    if (adsenseScriptRequested) return;
    adsenseScriptRequested = true;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + AD_CLIENT;
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);
  }
  function nvAdSlot(kind, label) {
    const d = document.createElement("div");
    d.className = "nv-ad nv-ad--" + kind;
    ensureAdSenseScript();
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    /* Yükseklik/genişlik ZORLANMAZ — bunu yaparsak dolmasa bile kutu
       "dolu" gibi ölçülür ve boş bir kutu görünür kalır. Boyut dış
       .nv-ad--side/--bar kabından gelir, ins sadece o alanı doldurur. */
    ins.style.display = "block";
    ins.style.width = "100%";
    ins.setAttribute("data-ad-client", AD_CLIENT);
    ins.setAttribute("data-ad-slot", AD_SLOT);
    ins.setAttribute("data-ad-format", "auto");
    if (kind === "bar") ins.setAttribute("data-full-width-responsive", "true");
    d.appendChild(ins);
    /* push() çağrısı ertelenir: nvAdSlot() döndüğü anda d henüz gerçek
       sayfaya eklenmemiş olabilir (çağıran sonra append/insertBefore
       yapıyor) — hemen push edilirse AdSense genişliği 0 ölçüp hata
       veriyordu. requestAnimationFrame ile bir sonraki boyama turuna
       ertelenir; o an hâlâ 0 genişlikse (ör. yan sütun <1400px'de
       gizli) hiç push edilmez — görünmeyen bir slot için istek atmanın
       anlamı yok. */
    requestAnimationFrame(() => {
      if (d.offsetWidth < 20) { d.hidden = true; return; }
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
      setTimeout(() => {
        /* AdSense çözüldüğünde data-ad-status="filled"/"unfilled" YAZAR —
           bu birincil sinyal. offsetHeight sadece o öznitelik hiç
           gelmediyse (nadir) yedek olarak kullanılır. */
        const status = ins.getAttribute("data-ad-status");
        const filled = status ? status === "filled" : ins.offsetHeight > 40;
        if (!filled) d.hidden = true;
      }, 3500);
    });
    return d;
  }

  function renderRamadanCountdown(hijriLong, isRamadan) {
    const box = document.getElementById("nvRamadan");
    if (!box) return;
    const h = isRamadan ? null : parseHijri(hijriLong);
    const n = h ? daysToRamadan(h) : null;
    if (!n) {
      /* Ramazan içindeyken banner konuşur; hicri tarih okunamadıysa uydurma
         sayı yerine bunu açıkça söyle */
      if (isRamadan || !hijriLong) { box.classList.remove("is-on"); box.textContent = ""; return; }
      box.innerHTML = '<p class="nv-ram-s">Hicri tarih okunamadığı için hesaplanamadı.</p>';
      box.classList.add("is-on");
      return;
    }
    box.textContent = "";
    const row = document.createElement("div");
    row.innerHTML = '<span class="nv-ram-n"></span><span class="nv-ram-u">gün kaldı</span>';
    row.querySelector(".nv-ram-n").textContent = String(n);
    const sub = document.createElement("p");
    sub.className = "nv-ram-s";
    sub.textContent = "Ramazan ayının başlamasına yaklaşık " + n +
      " gün var. Hicri takvim ay gözlemine dayandığı için başlangıç bir gün kayabilir.";
    box.append(row, sub);
    box.classList.add("is-on");
  }


  /* ── Hava durumu (menüde küçük gösterge) ── */
  /* Open-Meteo: anahtar gerektirmeyen, ücretsiz, CORS destekli geocoding +
     hava durumu servisi. Seçili il/ilçe ADINA göre konum bulunur (cihaz
     konumu değil — kullanıcı Ankara sayfasındayken fizik olarak başka
     şehirde olabilir, banttaki etiketle veri eşleşmeli). Cihaz konumu
     (varsa) sadece geocoding tamamen başarısız olursa son çare olarak
     kullanılır. Sonuçlar şehir başına önbelleklenir — renderWeatherTile()
     her saniye çağrıldığı için önbellek olmadan her tick'te ağ isteği
     atılırdı. */
  const WMO_TR = {
    0: "Açık", 1: "Az bulutlu", 2: "Parçalı bulutlu", 3: "Kapalı",
    45: "Sisli", 48: "Kırağı sisi",
    51: "Hafif çise", 53: "Çise", 55: "Yoğun çise", 56: "Donan çise", 57: "Yoğun donan çise",
    61: "Hafif yağmur", 63: "Yağmur", 65: "Kuvvetli yağmur", 66: "Donan yağmur", 67: "Kuvvetli donan yağmur",
    71: "Hafif kar", 73: "Kar", 75: "Kuvvetli kar", 77: "Kar taneleri",
    80: "Hafif sağanak", 81: "Sağanak", 82: "Kuvvetli sağanak",
    85: "Hafif kar sağanağı", 86: "Kuvvetli kar sağanağı",
    95: "Gök gürültülü sağanak", 96: "Dolulu fırtına", 99: "Kuvvetli dolulu fırtına",
  };
  /* WMO kodu → küçük çizgi ikon (sitenin diğer ikonlarıyla aynı stil:
     stroke=currentColor, stroke-width 1.6). Sadece 7 kategori yeterli —
     her kod tek tek ayırt edilebilir bir ikonu hak etmiyor. */
  const WX_ICON_PATHS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
    "cloud-sun": '<circle cx="7.5" cy="7" r="2"/><path d="M7.5 2.7v1.1M3.2 7h1.1M4.4 4.4l.8.8"/><path d="M9.2 19a4 4 0 0 1-.4-7.97A5.3 5.3 0 0 1 18.7 12a3.6 3.6 0 0 1-.4 7H9.2Z"/>',
    cloud: '<path d="M6.5 19a4.5 4.5 0 0 1-.4-8.98A6 6 0 0 1 18 9.06 4 4 0 0 1 17.5 17H6.5Z"/>',
    fog: '<path d="M3 8.5h13M3 12.5h18M6 16.5h13"/>',
    rain: '<path d="M6.5 15a4.5 4.5 0 0 1-.4-8.98A6 6 0 0 1 18 5.06 4 4 0 0 1 17.5 13H6.5Z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
    snow: '<path d="M6.5 14a4.5 4.5 0 0 1-.4-8.98A6 6 0 0 1 18 4.06 4 4 0 0 1 17.5 12H6.5Z"/><path d="M8 17v.01M12 18v.01M16 17v.01M8 15v.01M16 15v.01"/>',
    storm: '<path d="M6.5 13a4.5 4.5 0 0 1-.4-8.98A6 6 0 0 1 18 3.06 4 4 0 0 1 17.5 11H6.5Z"/><path d="M12.5 12l-2 4h3l-2 4"/>',
  };
  function wxIconKey(code) {
    if (code === 0) return "sun";
    if (code === 1 || code === 2) return "cloud-sun";
    if (code === 3) return "cloud";
    if (code === 45 || code === 48) return "fog";
    if (code >= 51 && code <= 67) return "rain";
    if (code >= 80 && code <= 82) return "rain";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if (code >= 95) return "storm";
    return "cloud";
  }
  function wxIconSvg(code) {
    const key = wxIconKey(code);
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + WX_ICON_PATHS[key] + "</svg>";
  }
  const wxGeoCache = new Map();
  async function wxGeocode(q) {
    if (wxGeoCache.has(q)) return wxGeoCache.get(q);
    let result = null;
    try {
      const res = await fetch(
        "https://geocoding-api.open-meteo.com/v1/search?count=1&language=tr&country=TR&name=" + encodeURIComponent(q),
        { cache: "no-store" }
      );
      if (res.ok) {
        const j = await res.json();
        const r = j && Array.isArray(j.results) && j.results[0];
        if (r && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)) {
          result = { lat: r.latitude, lon: r.longitude };
        }
      }
    } catch { result = null; }
    wxGeoCache.set(q, result);
    return result;
  }
  const WX_TTL_MS = 20 * 60 * 1000; // 20 dk — hava durumu bu sıklıkta yeterince taze
  const wxDataCache = new Map();
  async function weatherProvider(cityName, distName) {
    if (!cityName) return null;
    const cacheKey = cityName + "|" + (distName || "");
    const cached = wxDataCache.get(cacheKey);
    if (cached && Date.now() - cached.at < WX_TTL_MS) return cached.data;
    try {
      let coords = (distName && distName !== cityName) ? await wxGeocode(distName + ", " + cityName) : null;
      if (!coords) coords = await wxGeocode(cityName + ", Türkiye");
      if (!coords) coords = state.coords || null;
      if (!coords) return null;
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code&timezone=auto`,
        { cache: "no-store" }
      );
      if (!res.ok) return null;
      const j = await res.json();
      const cur = j && j.current;
      if (!cur || typeof cur.temperature_2m !== "number") return null;
      const data = {
        temp: cur.temperature_2m,
        code: cur.weather_code,
        desc: WMO_TR[cur.weather_code] || "",
        updated: typeof cur.time === "string" ? cur.time.slice(11, 16) : "",
      };
      wxDataCache.set(cacheKey, { data, at: Date.now() });
      return data;
    } catch { return null; }
  }


  async function renderWeatherTile() {
    const b = document.getElementById("nvWxTile");
    if (!b) return;
    let d = null;
    try { d = await weatherProvider(state.cityName, state.distName); } catch { d = null; }
    if (!d || typeof d.temp !== "number" || !isFinite(d.temp)) { b.hidden = true; return; }
    const html = wxIconSvg(d.code) + "<span>" + Math.round(d.temp) + "°</span>";
    if (b.innerHTML !== html) b.innerHTML = html;
    const t = placeLabel().long + (d.desc ? " · " + d.desc : "") + (d.updated ? " · güncelleme " + d.updated : "");
    b.title = t;
    b.setAttribute("aria-label", "Hava durumu: " + t);
    b.hidden = false;
  }

  // Service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();
})();
