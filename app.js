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

  const $ = (id) => document.getElementById(id);
  const els = {
    city: $("citySel"), dist: $("distSel"), err: $("errBox"), note: $("noteBox"),
    cdLabel: $("cdLabel"), cdTime: $("cdTime"), cdSub: $("cdSub"), 
    grid: $("prayerGrid"), mosques: $("mosqueList"), mosqueLink: $("mosqueMapLink"),
    dayPrev: $("dayPrev"), dayNext: $("dayNext"), dayLabel: $("dayLabel"), dayReset: $("dayReset"),
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
      els.cdSub.textContent = "Bugün için vakit bulunamadı.";
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
    applyTheme(current ? current.key : "Imsak");

    renderPrayerGrid(next);

    // countdown
    if (next) {
      const diff = next.dt - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      els.cdLabel.textContent = `Sıradaki · ${next.label}`;
      els.cdTime.innerHTML = `${pad(h)}<span class="sep">:</span>${pad(m)}<span class="sep">:</span>${pad(s)}`;
      els.cdSub.textContent = `${next.label} ezanına kalan süre · ${next.time}`;
    }
    if (els.heroLoc) els.heroLoc.textContent = `${state.cityName} · ${state.distName}`;

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
    if (isRamadan) {
      if (els.ramSahur) els.ramSahur.textContent = today.Imsak;
      if (els.ramIftar) els.ramIftar.textContent = today.Aksam;
    }

    // Cuma günü rozeti
    const isFriday = now.getDay() === 5;
    if (els.heroFriday) els.heroFriday.hidden = !isFriday;
    if (els.fridayCard) els.fridayCard.hidden = !isFriday;
  }

  /* ── Günlük vakit kartları (Bugün / ‹ Önceki Gün / Sonraki Gün ›) ──
     "Sıradaki vakit" geri sayımı her zaman gerçek "şu an"a bağlı kalır
     (yukarıda, değişmedi); bu fonksiyon sadece hangi GÜNÜN 6 vaktinin
     kart olarak gösterildiğini seçer. `liveNext`, sadece bugün görüntülenirken
     aktif-vakit vurgusu için kullanılır. */
  function renderPrayerGrid(liveNext) {
    const rec = getDayRecord(state.dayOffset);
    if (!rec) {
      els.grid.innerHTML = "";
      updateDayNav(null);
      return;
    }
    const isToday = state.dayOffset === 0;
    els.grid.innerHTML = PRAYERS.map((p) =>
      `<div class="p-card ${isToday && liveNext && liveNext.key === p.key ? "active" : ""}">
        <div class="ico">${p.ico}</div>
        <div class="lbl">${escapeHtml(p.label)}</div>
        <div class="tm">${escapeHtml(rec[p.key])}</div>
      </div>`
    ).join("");
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

    els.city.addEventListener("change", (e) => onCityChange(e.target.value));
    els.dist.addEventListener("change", (e) => onDistChange(e.target.value));
    els.locBtn.addEventListener("click", locateAndSelect);
    if (els.dayPrev) els.dayPrev.addEventListener("click", () => changeDay(-1));
    if (els.dayNext) els.dayNext.addEventListener("click", () => changeDay(1));
    if (els.dayReset) els.dayReset.addEventListener("click", () => changeDay(-state.dayOffset));
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

  // Service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();
})();
