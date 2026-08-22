/* ============================================================
   Namaz Vakitleri — Service Worker v1.0
   - Offline cache (app shell)
   - Push notification (ezan vakti)
   ============================================================ */

const CACHE = "namaz-v3";
const OFFLINE_URL = "/offline.html";

/* Uygulama kabuğu: her zaman cache'ten sun */
const SHELL = [
  "/",
  "/index.html",
  "/app.js",
  "/manifest.webmanifest",
  "/assets/icons/icon-192-v2.png",
  "/assets/icons/icon-512-v2.png",
  "/offline.html",
];

/* ── Install ── */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL))
  );
  self.skipWaiting();
});

/* ── Activate ── */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch stratejisi ──
   Shell dosyaları → Cache First
   API çağrıları  → Network First (başarısız olursa cache)
   Diğerleri       → Network First
*/
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // API isteklerini cache'leme
  if (url.hostname === "ezanvakti.emushaf.net") {
    e.respondWith(networkFirst(request));
    return;
  }

  // Yalnızca GET
  if (request.method !== "GET") return;

  // HTML sayfaları: Network First, offline fallback
  if (request.headers.get("Accept")?.includes("text/html")) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Statik varlıklar: Cache First
  e.respondWith(
    caches.match(request).then(
      (cached) => cached || fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      })
    )
  );
});

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const clone = res.clone();
      const cache = await caches.open(CACHE);
      cache.put(request, clone);
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "Offline" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

/* ── Push Notifications ── */
self.addEventListener("push", (e) => {
  let data = { title: "Namaz Vakti", body: "Vakit girdi.", icon: "/assets/icons/icon-192-v2.png" };
  try {
    data = { ...data, ...e.data.json() };
  } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/assets/icons/icon-192-v2.png",
      badge: "/assets/icons/icon-192-v2.png",
      tag: "ezan-vakti",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(target);
    })
  );
});
