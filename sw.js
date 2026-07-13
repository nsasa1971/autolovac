// ── Promeni ovaj broj pri svakom deploymentu ──────────────
const VERZIJA = "autolovac-v5";
// ─────────────────────────────────────────────────────────

const KESIRAJ = [
  "/",
  "/index.html",
  "/baza.json",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

// ── INSTALACIJA ───────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERZIJA).then((cache) => {
      return cache.addAll(KESIRAJ).catch((err) => {
        console.warn("[SW] Neki fajlovi nisu keširani:", err);
      });
    })
  );
  // Odmah preuzmi kontrolu — ne čekaj sledeće otvaranje
  self.skipWaiting();
});

// ── AKTIVACIJA — briše stare verzije ─────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((kljucevi) => {
      return Promise.all(
        kljucevi
          .filter((k) => k !== VERZIJA)
          .map((k) => {
            console.log("[SW] Brišem stari keš:", k);
            return caches.delete(k);
          })
      );
    }).then(() => {
      // Preuzmi kontrolu nad svim otvorenim tabovima odmah
      return self.clients.claim();
    })
  );
});

// ── FETCH — Network first za HTML i JSON, Cache first za ostalo
self.addEventListener("fetch", (e) => {
  const url = e.request.url;

  // Firebase i eksterni API — uvek mreža
  if (
    url.includes("firestore.googleapis.com") ||
    url.includes("firebase") ||
    url.includes("gstatic.com/firebasejs")
  ) {
    return;
  }

  // HTML i JSON — Network first (uvek pokušaj novu verziju)
  if (
    e.request.destination === "document" ||
    url.endsWith(".json") ||
    url.endsWith(".html")
  ) {
    e.respondWith(
      fetch(e.request)
        .then((odgovor) => {
          if (!odgovor || odgovor.status !== 200) return odgovor;
          const klon = odgovor.clone();
          caches.open(VERZIJA).then((cache) => cache.put(e.request, klon));
          return odgovor;
        })
        .catch(() => caches.match(e.request)) // offline fallback
    );
    return;
  }

  // Ostalo (CSS, JS, fontovi) — Cache first
  e.respondWith(
    caches.match(e.request).then((kesiran) => {
      if (kesiran) return kesiran;
      return fetch(e.request).then((odgovor) => {
        if (!odgovor || odgovor.status !== 200 || odgovor.type === "opaque") {
          return odgovor;
        }
        const klon = odgovor.clone();
        caches.open(VERZIJA).then((cache) => cache.put(e.request, klon));
        return odgovor;
      });
    })
  );
});

// ── PORUKA OD KLIJENTA ────────────────────────────────────
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
