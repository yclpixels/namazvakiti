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

  const SVG = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const PRAYERS = [
    { key: "Imsak",  label: "İmsak",  ico: SVG('<path d="M16 3.5A8.5 8.5 0 1 0 20.5 18 7 7 0 0 1 16 3.5Z"/>') },
    { key: "Gunes",  label: "Güneş",  ico: SVG('<path d="M6 15a6 6 0 0 1 12 0"/><path d="M2 15h20M12 2v4M8.5 6.5 12 3l3.5 3.5"/>') },
    { key: "Ogle",   label: "Öğle",   ico: SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>') },
    { key: "Ikindi", label: "İkindi", ico: SVG('<circle cx="9" cy="9" r="3.2"/><path d="M9 3.5v1.3M4.5 9H3M13.5 9H12M5.7 5.7l.9.9M12.3 5.7l-.9.9"/><path d="M6 20h11a3.2 3.2 0 0 0 .5-6.36A5 5 0 0 0 8 12.2 3.5 3.5 0 0 0 6 20Z"/>') },
    { key: "Aksam",  label: "Akşam",  ico: SVG('<path d="M6 15a6 6 0 0 1 12 0"/><path d="M2 15h20M12 2v4M8.5 3.5 12 7l3.5-3.5"/>') },
    { key: "Yatsi",  label: "Yatsı",  ico: SVG('<path d="M15 3.5A8 8 0 1 0 19.5 17 6.5 6.5 0 0 1 15 3.5Z"/><path d="M19.5 3.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z"/>') },
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
    shareBtn: $("shareBtn"),
    hero: $("hero"), heroLoc: $("heroLoc"), heroVakit: $("heroVakit"),
    cal: $("calBody"), calMonth: $("calMonth"),
    locBtn: $("locBtn"), loginBtn: $("loginBtn"), toast: $("toast"),
    heroHijri: $("heroHijri"), heroFriday: $("heroFriday"),
    statHijri: $("statHijri"), statQibla: $("statQibla"),
    fridayCard: $("fridayCard"), qiblaCard: $("qiblaCard"),
    ramadanBanner: $("ramadanBanner"), ramSahur: $("ramSahur"), ramIftar: $("ramIftar"),
    qiblaSecHead: $("qiblaSecHead"), qiblaWidget: $("qiblaWidget"),
    qiblaNeedle: $("qiblaNeedle"), qiblaDeg: $("qiblaDeg"), qiblaHint: $("qiblaHint"),
    qiblaPermBtn: $("qiblaPermBtn"),
    gAvatarWrap: $("gAvatarWrap"), gAvatar: $("gAvatar"), hiddenGoogleBtn: $("hiddenGoogleBtn"),
  };

  // Not: Google Cloud Console'dan alacağın kendi Client ID'ni buraya yapıştır
  const GOOGLE_CLIENT_ID = "BURAYA_KENDI_CLIENT_ID.apps.googleusercontent.com";
  const USER_KEY = "nv_user_v1";

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
  function applyTheme(prayerKey) {
    if (els.heroVakit) els.heroVakit.textContent = (PRAYER_NAMES[prayerKey] || "İKİNDİ") + " VAKTİ";
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
      const hb = document.querySelector('.nv-hbtn[data-nv="fav"]');
      if (hb) {
        hb.classList.toggle("is-on", active);
        const sp = hb.querySelector("span");
        if (sp) sp.textContent = active ? "Favorilerde" : "Favorilere Ekle";
      }
      els.favBtn.classList.toggle("active", active);
      const label = active ? "Favorilerden kaldır" : "Favorilere ekle";
      els.favBtn.setAttribute("aria-label", label);
      els.favBtn.title = label;
    }
    if (!els.favList) return;
    const list = loadFavorites();
    if (!list.length) {
      els.favList.innerHTML = `<div class="fav-empty">Henüz favori konumunuz yok. Üstteki yıldıza dokunarak mevcut konumu favorileyebilirsiniz.</div>`;
      return;
    }
    els.favList.innerHTML = list.map((f) => `
      <div class="fav-item">
        <button class="fav-select" data-city="${escapeHtml(f.cityId)}" data-dist="${escapeHtml(f.distId)}">
          <span class="fav-name">${escapeHtml(f.cityName)} / ${escapeHtml(f.distName)}</span>
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
      opt.textContent = c.SehirAdi;
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
      opt.textContent = d.IlceAdi;
      els.dist.appendChild(opt);
    }

    let pick = preferDistId && districts.find((d) => d.IlceID === preferDistId);
    if (!pick) pick = districts.find((d) => normTR(d.IlceAdi) === "merkez") || districts[0];
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
      tkrSync(null, "--:--:--");
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
    applyTheme(activeKey);
    notifCheck(activeKey);

    renderPrayerGrid(next, current, now);

    // countdown
    let cdText = "--:--:--";
    if (next) {
      const diff = next.dt - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      cdText = `${pad(h)}:${pad(m)}:${pad(s)}`;
      els.cdLabel.textContent = nvHeroNext ? "Sıradaki Vakit" : `Sıradaki · ${next.label}`;
      if (nvHeroNext && nvHeroNext.textContent !== next.label) nvHeroNext.textContent = next.label;
      els.cdTime.innerHTML = `${pad(h)}<span class="sep">:</span>${pad(m)}<span class="sep">:</span>${pad(s)}`;
      els.cdSub.textContent = `${next.label} ezanına kalan süre · ${next.time}`;
    }
    if (els.heroLoc) els.heroLoc.textContent = `${state.cityName} · ${state.distName}`;
    if (nvBandsBuilt) renderWeatherTile();

    // Hicri tarih — API'nin uzun alanını (ay adı yazılı) doğrudan göster, format tahmini yok
    const hijriLong = today.HicriTarihUzun || today.HijriTarihUzun || "";
    if (hijriLong) {
      // "16 Muharrem 1448" gibi; yıl kısmını kırpıp kartta göster
      if (els.heroHijri) els.heroHijri.textContent = hijriLong;
      if (els.statHijri) {
        const parts = hijriLong.split(" ");
        els.statHijri.textContent = parts.length >= 2 ? parts[0] + " " + parts[1] : hijriLong;
      }
    } else {
      const hijriShort = today.HicriTarihKisa || today.HijriTarihKisa || "";
      if (hijriShort && els.statHijri) els.statHijri.textContent = hijriShort;
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
    if (els.fridayCard) els.fridayCard.hidden = !isFriday;

    // Bilgi şeridi — aynı tick, ayrı sayaç/interval yok
    tkrSync(current, cdText);
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
    els.grid.innerHTML = PRAYERS.map((p) => {
      const isNow = nowKey === p.key;
      const isNext = nextKey === p.key;
      let cls = "p-card", sub = "";
      if (isNow) { cls += " is-now"; sub = '<span class="p-now"><i aria-hidden="true"></i>Şu an</span>'; }
      else if (isToday && base) {
        const dt = asDate(base, rec[p.key]);
        if (dt > now) sub = escapeHtml(remainText(dt - now));
        if (isNext) cls += " is-next";
      }
      if (isToday && !isNow && !sub) cls += " is-past";
      return `<div class="${cls}" data-prayer="${p.key}" tabindex="-1">
        <div class="ico">${p.ico}</div>
        <div class="lbl">${escapeHtml(p.label)}</div>
        <div class="tm">${escapeHtml(rec[p.key])}</div>
        <div class="p-sub">${sub}</div>
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
      els.calMonth.textContent = (d.MiladiTarihUzun || "").split(" ").slice(1, 3).join(" ")
        || new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
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
      ? `<button class="cal-toggle" id="calToggleBtn">${calExpanded ? "▲ Daha Az Göster" : "▼ Tümünü Gör (30 Gün)"}</button>`
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
    const todayPt = todayIdx >= 0 ? pts[todayIdx] : null;
    const fmtSpan = (mins) => Math.floor(mins / 60) + "sa " + pad(mins % 60) + "dk";
    const trend = spans[n - 1] - spans[0];
    const trendTxt = trend > 2 ? "uzuyor" : trend < -2 ? "kısalıyor" : "sabit";

    host.innerHTML =
      '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" style="width:100%;height:74px;display:block;" aria-hidden="true">' +
        '<path d="' + areaPath + '" fill="var(--brand-tint)"/>' +
        '<polyline points="' + line + '" fill="none" stroke="var(--brand-soft)" stroke-width="2"/>' +
        (todayPt ? '<circle cx="' + todayPt[0].toFixed(1) + '" cy="' + todayPt[1].toFixed(1) + '" r="3.5" fill="var(--accent)"/>' : "") +
      "</svg>" +
      '<div style="display:flex;justify-content:space-between;gap:10px;margin-top:8px;font-size:11px;color:var(--muted2);">' +
        "<span>Bugün: " + escapeHtml(fmtSpan(spans[todayIdx >= 0 ? todayIdx : 0])) + "</span>" +
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
    const strip = document.getElementById("nvVerseStrip");
    if (!panel && !strip) return;
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
      if (panel) panel.innerHTML = "";
      if (strip) strip.hidden = true;
    }
  }
  /* Panel (aşağıdaki "Günün Ayeti" bölümü) — tam metin + kaynak.
     Şerit (hero'da, geri sayımın altında) — kısaltılmış tek satır teaser;
     tam metni okumak isteyen aşağıdaki panele bakar. İkisi de AYNI
     çekilmiş veriden beslenir, ikinci bir istek atılmaz. */
  function paintVerse(d) {
    const panel = document.getElementById("nvVerse");
    if (panel) {
      panel.innerHTML =
        '<p style="font-family:Georgia,\'Times New Roman\',serif;font-size:clamp(16px,3.4vw,19px);line-height:1.6;color:var(--cream);margin-bottom:10px;">"' +
        escapeHtml(d.text) + '"</p>' +
        '<p style="color:var(--muted2);font-size:12px;">' + escapeHtml(d.sura) + " Suresi, " + d.ayahNo +
        ". Ayet — Diyanet İşleri Başkanlığı Meali</p>";
    }
    const strip = document.getElementById("nvVerseStrip");
    if (strip) {
      const teaser = d.text.length > 100 ? d.text.slice(0, 100).trim() + "…" : d.text;
      strip.innerHTML =
        '<span class="nv-verse-strip-lbl">Günün Ayeti</span>' +
        '<span class="nv-verse-strip-txt">' + escapeHtml(teaser) + "</span>";
      strip.hidden = false;
    }
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
      if (els.statQibla) els.statQibla.textContent = `${Math.round(qiblaAngle)}°`;
      if (els.qiblaNeedle) els.qiblaNeedle.style.transform = `translate(-50%,-100%) rotate(${qiblaAngle}deg)`;

      // iOS 13+ hareket sensörü izni
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") {
        if (els.qiblaHint) {
          els.qiblaHint.innerHTML = `Kıble yönü kuzeyden <b>${Math.round(qiblaAngle)}°</b> (${dirName}). Pusulayı canlı döndürmek için izin gerekir.`;
        }
        if (els.qiblaPermBtn) {
          els.qiblaPermBtn.textContent = "Pusulayı Etkinleştir";
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

  function openQiblaWidget() {
    if (els.qiblaSecHead) els.qiblaSecHead.style.display = "flex";
    if (els.qiblaWidget) els.qiblaWidget.style.display = "flex";
    els.qiblaWidget.scrollIntoView({ behavior: "smooth", block: "center" });
    if (qiblaAngle === null) findQibla();
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
  /* ── Google Girişi ── */
  function decodeJwt(token) {
    try {
      const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
      );
      return JSON.parse(json);
    } catch { return null; }
  }

  function showLoggedInUser(user) {
    if (els.loginBtn) els.loginBtn.hidden = true;
    if (els.gAvatarWrap) els.gAvatarWrap.hidden = false;
    if (els.gAvatar) {
      // Sadece http(s) resim URL'lerini kabul et (decode edilen JWT imza-doğrulanmadığı için savunma amaçlı)
      els.gAvatar.src = /^https:\/\//.test(user.picture || "") ? user.picture : "";
      els.gAvatar.title = `${user.name} — çıkış için dokun`;
    }
  }

  function showLoggedOut() {
    if (els.loginBtn) els.loginBtn.hidden = false;
    if (els.gAvatarWrap) els.gAvatarWrap.hidden = true;
  }

  function handleCredentialResponse(response) {
    const payload = decodeJwt(response.credential);
    if (!payload) { toast("Giriş başarısız oldu."); return; }
    const user = { name: payload.name, email: payload.email, picture: payload.picture };
    try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
    showLoggedInUser(user);
    toast(`Hoş geldin, ${payload.given_name || payload.name}!`);
  }

  function logoutUser() {
    try { localStorage.removeItem(USER_KEY); } catch {}
    showLoggedOut();
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    toast("Çıkış yapıldı.");
  }

  function initGoogleAuth() {
    if (GOOGLE_CLIENT_ID.indexOf("BURAYA_KENDI") === 0) {
      // Client ID henüz ayarlanmamış — giriş butonu görünür ama uyarı verir
      els.loginBtn.addEventListener("click", () =>
        toast("Google girişi için Client ID ayarlanmalı (BURADAN-BASLA.txt'ye bak).")
      );
      return;
    }
    if (!window.google || !google.accounts || !google.accounts.id) {
      setTimeout(initGoogleAuth, 300);
      return;
    }
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
    });
    google.accounts.id.renderButton(els.hiddenGoogleBtn, { theme: "outline", size: "large" });

    els.loginBtn.addEventListener("click", () => {
      const realBtn = els.hiddenGoogleBtn && els.hiddenGoogleBtn.querySelector("div[role=button]");
      if (realBtn) realBtn.click();
      else google.accounts.id.prompt();
    });

    // Önceki oturumu geri yükle
    try {
      const saved = localStorage.getItem(USER_KEY);
      if (saved) showLoggedInUser(JSON.parse(saved));
    } catch {}

    if (els.gAvatarWrap) els.gAvatarWrap.addEventListener("click", () => {
      if (confirm("Çıkış yapmak istiyor musun?")) logoutUser();
    });
  }

  async function init() {
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
            state.districtFallbackNote = `Diyanet, ${pageDist} için ayrı vakit yayınlamıyor; ${city.SehirAdi} geneli için hesaplanan merkezi vakitler gösteriliyor.`;
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
    nvHeader();
    nvHero();
    nvDash();
    nvBands();
    tkrBuild();
    nvShell();

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
    if (els.qiblaCard) els.qiblaCard.addEventListener("click", openQiblaWidget);
    if (els.qiblaPermBtn) els.qiblaPermBtn.addEventListener("click", findQibla);
    initGoogleAuth();
    els.mosqueLink.addEventListener("click", () => {
      if (state.coords) {
        window.open(`https://www.google.com/maps/search/cami/@${state.coords.lat},${state.coords.lon},15z`, "_blank");
      } else {
        toast("Önce konum izni verin.");
        locateAndSelect();
      }
    });
  }

  /* ══ Bilgi şeridi (hero altı ticker + compact sticky bar) ═════════════
     - Markup burada üretilir; hiçbir HTML/SEO dosyası değişmez.
     - Hareket tamamen CSS animasyonu; JS sadece içerik gerçekten
       değiştiğinde (konum / gün / aktif vakit / motion tercihi) DOM'a dokunur.
     - Geri sayım metni mevcut renderGridAndCountdown tick'inden gelir;
       yeni bir sayaç veya interval kurulmaz. */
  const TKR_SPEED = 26; // px/sn — yavaş, sakin akış
  const tkrReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tkr = {
    built: false, root: null, rail: null, track: null,
    sticky: null, sLoc: null, sNow: null, sCd: null, sig: "", hl: null,
  };

  /* Tek bir vakit dizisi. `primary` olmayan kopyalar yalnızca kesintisiz
     loop için vardır: ekran okuyucudan ve tab sırasından çıkarılır. */
  function tkrSeq(rec, activeKey, place, dayLabel, primary) {
    const div = '<span class="tkr-div" aria-hidden="true">·</span>';
    const out = [];
    /* Konum ve gün artık sabit satırda değil, akışın içinde: şerit tek
       satır olduğu için bu bilgiler de kullanıcıya akarak ulaşıyor. */
    out.push(`<span class="tkr-place">${escapeHtml(place)}</span>`, div);
    if (dayLabel) out.push(`<span class="tkr-day">${escapeHtml(dayLabel)}</span>`, div);
    if (activeKey) {
      out.push(`<span class="tkr-now"><i aria-hidden="true"></i>Şu an ${escapeHtml(PRAYER_NAMES[activeKey] || "")}</span>`, div);
    }
    for (const p of PRAYERS) {
      const attrs = primary
        ? `aria-label="${escapeHtml(p.label)} vakti ${escapeHtml(rec[p.key])} — vakit kartına git"`
        : 'tabindex="-1"';
      /* Şeritte bakır = "şu an devam eden vakit". Şeridin kendi metni
         ("ŞU AN …") bu anlamı açıkça yazdığı için renk tek başına
         bilgi taşımıyor. */
      out.push(
        `<button type="button" class="tkr-item${activeKey === p.key ? " is-now" : ""}" data-goto="${p.key}" ${attrs}>` +
        `<span class="tkr-lbl">${escapeHtml(p.label)}</span>` +
        `<span class="tkr-tm">${escapeHtml(rec[p.key])}</span></button>`, div);
    }
    /* Kopya diziler tamamen ekran okuyucudan çıkarılır (loop artefaktı). */
    return `<div class="tkr-seq"${primary ? "" : ' aria-hidden="true"'}>${out.join("")}</div>`;
  }

  function tkrRender(rec, activeKey, place, dayLabel) {
    if (tkrReduce.matches) {
      tkr.track.style.removeProperty("--tkr-dur");
      tkr.track.innerHTML = tkrSeq(rec, activeKey, place, dayLabel, true);
      tkr.rail.scrollLeft = 0;
      return;
    }
    // 1) Bir diziyi ölç
    tkr.track.innerHTML = tkrSeq(rec, activeKey, place, dayLabel, true);
    const seqW = tkr.track.firstElementChild ? tkr.track.firstElementChild.offsetWidth : 0;
    /* Ölçüm alınamadıysa (henüz layout yok) tek dizi kalır ve loop dikişi
       tutmaz → imzayı sıfırla ki bir sonraki tick tekrar denesin. */
    if (!seqW) { tkr.sig = ""; return; }
    // 2) Track'in yarısı rail'i doldurmalı, yoksa loop başında boşluk oluşur
    const k = Math.max(1, Math.ceil((tkr.rail.clientWidth || seqW) / seqW) + 1);
    let html = tkrSeq(rec, activeKey, place, dayLabel, true);
    for (let i = 1; i < k * 2; i++) html += tkrSeq(rec, activeKey, place, dayLabel, false);
    tkr.track.innerHTML = html;
    // 3) Süre genişliğe göre → her ekranda aynı, sabit px/sn hız
    tkr.track.style.setProperty("--tkr-dur", ((k * seqW) / TKR_SPEED).toFixed(1) + "s");
  }

  function tkrGoto(key) {
    const card = els.grid && els.grid.querySelector('.p-card[data-prayer="' + key + '"]');
    if (!card) return;
    card.scrollIntoView({ behavior: tkrReduce.matches ? "auto" : "smooth", block: "center" });
    try { card.focus({ preventScroll: true }); } catch { card.focus(); }
    card.classList.add("p-card--target");
    clearTimeout(tkr.hl);
    tkr.hl = setTimeout(() => card.classList.remove("p-card--target"), 1800);
  }

  function tkrBuild() {
    if (tkr.built || !els.hero || !els.hero.parentNode) return;
    tkr.built = true;

    const sec = document.createElement("section");
    sec.className = "tkr";
    sec.id = "tickerBar";
    sec.hidden = true;
    sec.setAttribute("aria-label", "Namaz vakitleri şeridi");
    /* Tek satır: solda sabit CANLI göstergesi, sağda tam genişlikte akış.
       .tkr-inner kaldırıldı — şerit artık --container'a takılmıyor. */
    sec.innerHTML =
      '<div class="tkr-live"><i aria-hidden="true"></i>Canlı</div>' +
      '<div class="tkr-rail"><div class="tkr-track"></div></div>';
    /* Şerit sayfanın EN ÜSTÜNDE olmalı — header/hero'nun bile önünde.
       .wrap'in ilk elemanı olarak eklenir (nvHeader() bu noktada zaten
       çalışmış olabilir; firstElementChild o zaman header'dır). */
    const wrap = els.hero.parentNode;
    wrap.insertBefore(sec, wrap.firstElementChild);

    /* Compact sticky bar — sayfadaki bilgiyi tekrarladığı ve etkileşimli
       öğe içermediği için ekran okuyucudan gizli. */
    const bar = document.createElement("div");
    bar.className = "tkr-sticky";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML =
      '<div class="tkr-sticky-inner">' +
        '<span class="tkr-s-brand">Namaz Vakitleri</span>' +
        '<span class="tkr-sep tkr-s-sep">·</span>' +
        '<span class="tkr-s-loc"></span>' +
        '<span class="tkr-s-now"><i></i><span class="tkr-s-now-lbl"></span></span>' +
        '<span class="tkr-sep">·</span>' +
        '<span class="tkr-s-cd">--:--:--</span>' +
      '</div>';
    document.body.appendChild(bar);

    tkr.root = sec;
    tkr.rail = sec.querySelector(".tkr-rail");
    tkr.track = sec.querySelector(".tkr-track");
    tkr.sticky = bar;
    tkr.sLoc = bar.querySelector(".tkr-s-loc");
    tkr.sNow = bar.querySelector(".tkr-s-now-lbl");
    tkr.sCd = bar.querySelector(".tkr-s-cd");

    tkr.rail.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-goto]");
      if (btn) tkrGoto(btn.dataset.goto);
    });

    /* Klavyeyle gezinirken tarayıcı, odaklanan butonu görünür kılmak için
       rail'i kaydırır (doğru davranış; animasyon focus-within ile duruyor).
       Odak şeritten ayrılınca kaydırmayı sıfırla, yoksa loop kalıcı kayar.
       Hareket azaltma modunda rail'i kullanıcı kaydırıyor → dokunma. */
    tkr.rail.addEventListener("focusout", (e) => {
      if (tkrReduce.matches) return;
      if (!e.relatedTarget || !tkr.rail.contains(e.relatedTarget)) tkr.rail.scrollLeft = 0;
    });

    // Şerit ekranda değilken animasyonu durdur (pil/CPU)
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((ents) => {
        sec.classList.toggle("is-paused", !ents[0].isIntersecting);
      }, { threshold: 0 }).observe(sec);
    }

    let queued = false;
    const onScroll = () => {
      queued = false;
      bar.classList.toggle("is-on", !sec.hidden && sec.getBoundingClientRect().bottom < 0);
    };
    window.addEventListener("scroll", () => {
      if (!queued) { queued = true; requestAnimationFrame(onScroll); }
    }, { passive: true });

    /* Genişlik veya motion tercihi değişince kopya sayısı ve süre yeniden
       hesaplanmalı: imzayı sıfırla, bir sonraki tick yeniden kurar. */
    const invalidate = () => { tkr.sig = ""; };
    window.addEventListener("resize", invalidate, { passive: true });
    if (tkrReduce.addEventListener) tkrReduce.addEventListener("change", invalidate);
    else if (tkrReduce.addListener) tkrReduce.addListener(invalidate);
  }

  /* ══ Sayfa kabuğu — reklam kolonları ═══════════════════════════════
     Şeridin ALTINDAKİ her şeyi (h1, breadcrumb, body-pad) 3 kolonlu bir
     grid'in orta sütununa TAŞIR. Düğümler yeniden üretilmez, sadece yer
     değiştirir; bu yüzden mevcut event listener'lar ve element
     referansları (els.*) aynen çalışmaya devam eder.
     Reklamlar yalnızca ≥1400px'de görünür (CSS, yan sütunlar); alt bar
     her genişlikte. ads.txt ve legacy statik sayfalarda (hakkimizda vb.)
     zaten kullanılan gerçek AdSense yayıncı kimliği burada da kullanılır —
     yeni bir hesap/onay gerekmez. Doldurulamayan (onay bekleyen/envanter
     yok) slotlar kırık kutu göstermek yerine tamamen gizlenir. */
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
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    setTimeout(() => {
      /* AdSense çözüldüğünde data-ad-status="filled"/"unfilled" YAZAR —
         bu birincil sinyal. offsetHeight sadece o öznitelik hiç
         gelmediyse (nadir) yedek olarak kullanılır. */
      const status = ins.getAttribute("data-ad-status");
      const filled = status ? status === "filled" : ins.offsetHeight > 40;
      if (!filled) d.hidden = true;
    }, 3500);
    return d;
  }
  /* Header: marka (sol) · konum seçici (orta) · aksiyonlar (sağ).
     Mevcut .topbar içeriği ve .selectors buraya TAŞINIR. */
  let nvHeaderBuilt = false;
  function nvHeader() {
    if (nvHeaderBuilt) return;
    const wrap = document.querySelector(".wrap");
    const heroEl = els.hero;
    if (!wrap || !heroEl) return;
    const topbar = heroEl.querySelector(".topbar");
    const brand = topbar && topbar.querySelector(".brand");
    const actions = topbar && topbar.querySelector(".top-actions");
    const sel = heroEl.querySelector(".selectors");
    if (!topbar || !brand || !actions || !sel) return;
    nvHeaderBuilt = true;

    const h = document.createElement("header");
    h.className = "nv-header";
    h.append(brand, sel, actions);          // düğüm taşıma
    wrap.insertBefore(h, heroEl);
    topbar.remove();                        // artık boş
  }

  /* Hero: sol (konum + tarih) · orta (sıradaki vakit + geri sayım) ·
     sağ (aksiyonlar). H1 sol kolona "eyebrow" olarak taşınır — sayfada
     tek H1 kalır, SEO metni birebir korunur. */
  let nvHeroBuilt = false;
  function nvHero() {
    if (nvHeroBuilt) return;
    const inner = els.hero && els.hero.querySelector(".hero-inner");
    const cd = inner && inner.querySelector(".cd-card");
    const loc = inner && inner.querySelector(".hero-loc");
    const meta = inner && inner.querySelector(".hero-meta");
    if (!inner || !cd || !loc || !meta) return;
    nvHeroBuilt = true;

    const left = document.createElement("div");
    left.className = "nv-hero-l";
    const h1 = document.querySelector(".nv-main > h1, .wrap > h1");
    if (h1) { h1.classList.add("nv-eyebrow"); left.appendChild(h1); }
    left.append(loc, meta);

    /* Sıradaki vaktin ADI kendi satırında (referanstaki hiyerarşi) */
    const name = document.createElement("div");
    name.className = "nv-next";
    cd.insertBefore(name, cd.querySelector(".cd-row"));

    const right = document.createElement("div");
    right.className = "nv-hero-r";
    right.innerHTML =
      '<button type="button" class="nv-hbtn" data-nv="city">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.3"/></svg>' +
        "<span>Şehri Değiştir</span></button>" +
      '<button type="button" class="nv-hbtn" data-nv="fav">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5Z"/></svg>' +
        "<span>Favorilere Ekle</span></button>" +
      '<button type="button" class="nv-hbtn" data-nv="notif">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7Z"/><path d="M9.5 18a2.5 2.5 0 0 0 5 0"/></svg>' +
        '<span class="nv-notif-lbl">Ezan Bildirimi</span></button>';
    if (loadNotifPref() && typeof Notification !== "undefined" && Notification.permission === "granted") {
      right.querySelector('[data-nv="notif"]').classList.add("is-on");
    }
    /* Mevcut kontrollere delege eder — ikinci bir mantık yazılmaz */
    right.addEventListener("click", (e) => {
      const b = e.target.closest("[data-nv]");
      if (!b) return;
      if (b.dataset.nv === "fav") { els.favBtn && els.favBtn.click(); return; }
      if (b.dataset.nv === "notif") { toggleNotifications(b); return; }
      const s = els.city;
      if (!s) return;
      s.focus();
      try { if (typeof s.showPicker === "function") s.showPicker(); } catch {}
    });

    const verseStrip = document.createElement("div");
    verseStrip.id = "nvVerseStrip";
    verseStrip.className = "nv-verse-strip";
    verseStrip.hidden = true;

    inner.append(left, cd, right, verseStrip);
    nvHeroNext = name;
  }
  let nvHeroNext = null;

  /* ══ Dashboard ═════════════════════════════════════════════════════
     Tek tip kart galerisi DEĞİL: dört ayrı yüzey dili
       tool      → kıble (araç paneli)
       list      → camiler, favoriler
       data      → aylık takvim (veri tablosu)
       editorial → dua, SSS (zeminsiz, tipografik)                     */
  /* Kalan gün YALNIZCA Diyanet'in hicri tarihinden hesaplanır. Hicri alan
     yoksa veya ay adı tanınmazsa hiçbir şey gösterilmez (uydurma yok). */
  function renderRamadanCountdown(hijriLong, isRamadan) {
    const box = document.getElementById("nvRamadan");
    if (!box) return;
    const h = isRamadan ? null : parseHijri(hijriLong);
    const n = h ? daysToRamadan(h) : null;
    if (!n) { box.classList.remove("is-on"); box.textContent = ""; return; }
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

  /* ══ Veri sağlayıcı adaptörleri ═══════════════════════════════════
     Sözleşme:
       financeProvider() → null  (kaynak yok)
                         | [{ key, label, value, change }]
                           value: gösterilecek METİN (biçimlendirilmiş)
                           change: sayı (yüzde) | null
       weatherProvider(city, dist) → null
                         | { temp:Number, desc:String, updated:String }
     financeProvider hâlâ BİLİNÇLİ olarak null döner: bağlı bir finans veri
     kaynağı yok ve uydurma değer gösterilmeyecek — bant o zaman hiç
     çizilmez. weatherProvider ise Open-Meteo'ya (anahtarsız, ücretsiz)
     bağlıdır; kaynağa ulaşılamazsa yine null döner, sahte değer basılmaz. */
  async function financeProvider() {
    return null;
  }

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

  const FIN_ORDER = [
    { key: "EUR", label: "EURO" },
    { key: "USD", label: "DOLAR" },
    { key: "GBP", label: "STERLİN" },
    { key: "XAU", label: "GRAM ALTIN" },
  ];

  function nvBandEl(id, kind, label) {
    let b = document.getElementById(id);
    if (b) return b;
    b = document.createElement("aside");
    b.id = id;
    b.className = "nv-band nv-band--" + kind;
    b.hidden = true;
    b.innerHTML = '<div class="nv-band-in"><span class="nv-band-lbl"></span>' +
      '<div class="nv-band-c"></div><span class="nv-band-src"></span></div>';
    b.querySelector(".nv-band-lbl").textContent = label;
    return b;
  }

  function nvNum(n) {
    return (n > 0 ? "+" : "") + n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + "%";
  }

  async function renderFinanceBand() {
    const b = document.getElementById("nvFinance");
    if (!b) return;
    let data = null;
    try { data = await financeProvider(); } catch { data = null; }
    if (!Array.isArray(data) || !data.length) { b.hidden = true; return; }
    const by = {};
    data.forEach((d) => { if (d && d.key) by[d.key] = d; });
    const c = b.querySelector(".nv-band-c");
    c.textContent = "";
    /* Sıra sabittir: EURO → DOLAR → STERLİN → GRAM ALTIN.
       Kaynakta olmayan kalem hiç basılmaz (yer tutucu değer yok). */
    FIN_ORDER.forEach((f) => {
      const d = by[f.key];
      if (!d || d.value == null || d.value === "") return;
      const it = document.createElement("span");
      it.className = "nv-bi";
      const k = document.createElement("span"); k.className = "nv-bi-k"; k.textContent = f.label;
      const v = document.createElement("span"); v.className = "nv-bi-v"; v.textContent = d.value;
      it.append(k, v);
      if (typeof d.change === "number" && isFinite(d.change)) {
        const ch = document.createElement("span");
        ch.className = "nv-bi-c " + (d.change < 0 ? "is-dn" : "is-up");
        ch.textContent = nvNum(d.change);
        it.appendChild(ch);
      }
      c.appendChild(it);
    });
    const src = b.querySelector(".nv-band-src");
    src.textContent = data.updated ? "Güncelleme · " + data.updated : "";
    b.hidden = !c.childElementCount;
  }

  /* Hava durumu artık body-pad'de yatay bir bant değil, hero/header'daki
     küçük KARE bir rozet — konum/giriş butonlarıyla aynı boyut/dil
     (bkz. .nv-wx-tile). İkon WMO koduna göre seçilir (wxIconSvg). */
  async function renderWeatherTile() {
    const b = document.getElementById("nvWxTile");
    if (!b) return;
    let d = null;
    try { d = await weatherProvider(state.cityName, state.distName); } catch { d = null; }
    if (!d || typeof d.temp !== "number" || !isFinite(d.temp)) { b.hidden = true; return; }
    b.innerHTML = wxIconSvg(d.code) + '<span class="nv-wx-tile-t">' + Math.round(d.temp) + "°</span>";
    const locTxt = [state.cityName, state.distName].filter(Boolean).join(" · ");
    b.title = locTxt + (d.desc ? " · " + d.desc : "") + (d.updated ? " · Güncelleme " + d.updated : "");
    b.setAttribute("aria-label", "Hava durumu: " + b.title);
    b.hidden = false;
  }

  /* Üstte finans bandı (şu an kaynaksız, hep gizli). Hava durumu ise
     header'daki top-actions'a küçük kare bir rozet olarak eklenir. */
  let nvBandsBuilt = false;
  function nvBands() {
    if (nvBandsBuilt) return;
    const pad = document.querySelector(".body-pad");
    const actions = document.querySelector(".nv-header .top-actions");
    if (!pad || !actions) return;
    nvBandsBuilt = true;
    pad.prepend(nvBandEl("nvFinance", "fin", "Piyasa"));
    renderFinanceBand();

    const tile = document.createElement("div");
    tile.id = "nvWxTile"; tile.className = "nv-wx-tile"; tile.hidden = true;
    actions.insertBefore(tile, actions.firstChild);
    renderWeatherTile();
  }

  let nvDashBuilt = false;
  function nvPanel(kind, title, nodes, link) {
    const p = document.createElement("section");
    p.className = "nv-panel nv-panel--" + kind;
    if (title) {
      const h = document.createElement("div");
      h.className = "nv-panel-h";
      h.innerHTML = '<span class="nv-panel-t">' + escapeHtml(title) + "</span>";
      if (link) h.appendChild(link);
      p.appendChild(h);
    }
    const b = document.createElement("div");
    b.className = "nv-panel-b";
    nodes.filter(Boolean).forEach((n) => b.appendChild(n));
    p.appendChild(b);
    return p;
  }
  /* Bir .sec-head + ardından gelen içerik düğümlerini bulur */
  function nvSection(contentSel) {
    const c = document.querySelector(contentSel);
    if (!c) return null;
    const head = c.previousElementSibling && c.previousElementSibling.classList.contains("sec-head")
      ? c.previousElementSibling : null;
    const title = head ? (head.querySelector(".sec-title") || {}).textContent : "";
    const link = head ? head.querySelector(".sec-link") : null;
    if (head) head.remove();
    return { node: c, title: (title || "").trim(), link };
  }

  function nvDash() {
    if (nvDashBuilt) return;
    const pad = document.querySelector(".body-pad");
    if (!pad) return;
    nvDashBuilt = true;

    const dash = document.createElement("div"); dash.className = "nv-dash";
    const sub = document.createElement("div"); sub.className = "nv-sub";

    /* 1) KIBLE — araç paneli. Widget artık baştan görünür (referanstaki
          gibi pusula + derece + "Kıbleyi Bul"). openQiblaWidget() hâlâ
          çalışır; sadece gizli başlamıyor. */
    const qHead = els.qiblaSecHead, qw = els.qiblaWidget;
    if (qHead) qHead.remove();
    if (qw) { qw.style.display = "flex"; dash.appendChild(nvPanel("tool", "Kıble Yönü", [qw])); }

    /* 2) HİCRİ — mevcut stat-card'lar taşınır (JS onları güncellemeye
          devam eder). Kıble stat-card'ı artık gereksiz: gizlenir. */
    const statRow = document.querySelector(".stat-row");
    if (statRow) {
      const hicri = statRow.querySelector(".stat-card:not(.stat-clickable):not([id])");
      if (els.qiblaCard) els.qiblaCard.style.display = "none";
      const calLink = document.createElement("button");
      calLink.type = "button"; calLink.className = "nv-plink"; calLink.textContent = "Tüm Takvimi Gör";
      calLink.addEventListener("click", () => {
        const t = document.getElementById("calBody");
        if (t) t.scrollIntoView({ behavior: tkrReduce.matches ? "auto" : "smooth", block: "center" });
      });
      dash.appendChild(nvPanel("info", "Hicri Takvim", [hicri, els.fridayCard], calLink));
      statRow.remove();
    }

    /* 3) CAMİLER — liste */
    const mos = nvSection("#mosqueList");
    if (mos) dash.appendChild(nvPanel("list", mos.title || "Yakın Camiler", [mos.node], mos.link));

    /* 4) DUA — editoryal */
    const dua = nvSection(".dua-grid");
    if (dua) dash.appendChild(nvPanel("editorial", dua.title || "Dua Vakitleri", [dua.node]));

    /* 5) RAMAZAN — mevcut banner + hicri tarihten türetilen gün sayısı */
    const ram = document.createElement("div");
    ram.className = "nv-ram"; ram.id = "nvRamadan";
    if (els.ramadanBanner) { els.ramadanBanner.classList.add("nv-ram-banner"); }
    const ramPanel = nvPanel("info", "Ramazan", [ram, els.ramadanBanner]);

    /* ── ikinci sıra ── */
    sub.appendChild(ramPanel);
    const fav = nvSection(".fav-list");
    if (fav) sub.appendChild(nvPanel("list", fav.title || "Favori Konumlarım", [fav.node]));

    const calHead = document.querySelector(".cal-head");
    const calBody = document.getElementById("calBody");
    if (calBody) {
      const h = calHead && calHead.previousElementSibling && calHead.previousElementSibling.classList.contains("sec-head")
        ? calHead.previousElementSibling : null;
      const t = h ? (h.querySelector(".sec-title") || {}).textContent : "Aylık Vakitler";
      const meta = h ? h.querySelector(".sec-meta") : null;
      if (h) h.remove();
      const calPanel = nvPanel("data", (t || "Aylık Vakitler").trim(), [calHead, calBody], meta);
      calPanel.classList.add("nv-panel--calendar");
      const printTitle = document.createElement("div");
      printTitle.className = "nv-print-title";
      calPanel.querySelector(".nv-panel-b").prepend(printTitle);
      const printBtn = document.createElement("button");
      printBtn.type = "button"; printBtn.className = "nv-plink"; printBtn.textContent = "Yazdır";
      printBtn.addEventListener("click", () => {
        printTitle.textContent = [state.cityName, state.distName].filter(Boolean).join(" · ") + " — İmsakiye";
        calExpanded = true;
        renderCalendar();
        window.print();
      });
      calPanel.querySelector(".nv-panel-h").appendChild(printBtn);
      sub.appendChild(calPanel);
    }

    /* Mevsimsel trend — zaten çekilmiş olan aylık veriden türetilir,
       ek bir istek atılmaz. renderTrendChart() veriyi loadTimes() sonrası
       doldurur; burada sadece boş kap oluşturulur. */
    const trendHost = document.createElement("div");
    trendHost.id = "nvTrend";
    const trendPanel = nvPanel("data", "İmsak–Yatsı Aralığı", [trendHost]);
    trendPanel.classList.add("nv-panel--trend");
    sub.appendChild(trendPanel);

    /* Günün Ayeti — Diyanet meali, api.alquran.cloud üzerinden canlı çekilir
       (metin ezbere/uydurma değil). renderDailyVerse() dolduruyor. */
    const verseHost = document.createElement("div");
    verseHost.id = "nvVerse";
    verseHost.innerHTML = '<p style="color:var(--muted2);font-size:13px;">Yükleniyor…</p>';
    sub.appendChild(nvPanel("editorial", "Günün Ayeti", [verseHost]));

    const cities = nvSection(".city-links");
    if (cities) sub.appendChild(nvPanel("editorial", cities.title || "Popüler Şehirler", [cities.node], cities.link));

    const faq = nvSection(".faq-wrap");
    if (faq) sub.appendChild(nvPanel("editorial", faq.title || "Sık Sorulan Sorular", [faq.node]));

    /* two-col boşaldıysa kaldırılır. İçinde metinsiz sarmalayıcı div'ler
       kalabildiği için varlık değil GERÇEK İÇERİK kontrolü yapılır. */
    const tc = document.querySelector(".two-col");
    if (tc && !tc.textContent.trim() && !tc.querySelector("img,svg,input,select,button,a")) tc.remove();

    pad.append(dash, sub);
    renderTrendChart(); // #nvTrend artık gerçek DOM'a eklendi — burada çalışmalı
    renderDailyVerse(); // #nvVerse artık gerçek DOM'a eklendi — burada çalışmalı
  }

  let nvShellBuilt = false;
  function nvShell() {
    if (nvShellBuilt) return;
    const wrap = document.querySelector(".wrap");
    const foot = wrap && wrap.querySelector(":scope > footer");
    const tkrEl = document.getElementById("tickerBar");
    if (!wrap || !foot || !tkrEl) return;
    nvShellBuilt = true;

    const shell = document.createElement("div");
    shell.className = "nv-shell";
    const main = document.createElement("div");
    main.className = "nv-main";
    shell.append(nvAdSlot("side", "160 × 600"), main, nvAdSlot("side", "160 × 600"));

    /* Masthead (şerit + header + hero) ile footer arasındaki her şeyi orta
       sütuna taşı. Şerit artık hero'nun ÖNÜNDE olduğu için sınır hero'nun
       kendisinden hesaplanır — tkrEl'in DOM'daki yeri artık önemli değil. */
    const moved = [];
    for (let n = els.hero.nextElementSibling; n && n !== foot; n = n.nextElementSibling) moved.push(n);
    wrap.insertBefore(shell, foot);
    moved.forEach((n) => main.appendChild(n));

    /* Alt yatay reklam — ana içerikten sonra, footer'dan önce */
    const bar = nvAdSlot("bar", "728 × 90");
    wrap.insertBefore(bar, foot);
  }

  function tkrSync(current, cdText) {
    if (!tkr.built) tkrBuild();
    if (!tkr.root) return;
    const rec = getDayRecord(state.dayOffset);
    if (!rec || !state.cityName || !state.distName) {
      tkr.root.hidden = true;
      tkr.sticky.classList.remove("is-on");
      tkr.sig = "";
      return;
    }
    tkr.root.hidden = false;
    /* Gece yarısı ile imsak arasında bugünün hiçbir vakti henüz girmemiştir;
       fiilen devam eden vakit yatsıdır. */
    const liveKey = current ? current.key : "Yatsi";
    // Dün/yarın görüntülenirken "şu an" vurgusu yanıltıcı olur → kullanılmaz.
    const activeKey = state.dayOffset === 0 ? liveKey : null;
    const sig = [state.distId, state.cityName, state.distName, state.dayOffset,
      rec.MiladiTarihKisa, activeKey, tkrReduce.matches ? 1 : 0].join("|");
    if (sig !== tkr.sig) {
      tkr.sig = sig;
      const place = state.distName + " / " + state.cityName;
      tkr.sLoc.textContent = place;
      tkrRender(rec, activeKey, place, dayLabelFor(state.dayOffset, rec));
    }
    const nowLbl = PRAYER_NAMES[liveKey] || "";
    if (tkr.sNow.textContent !== nowLbl) tkr.sNow.textContent = nowLbl;
    if (tkr.sCd.textContent !== cdText) tkr.sCd.textContent = cdText;
  }

  // Service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();
})();
