const CACHE_IME = "autolovac-v1";

// Fajlovi koji se keširaju pri instalaciji
const KESIRAJ_PRI_INSTALACIJI = [
  "/",
  "/index.html",
  "/baza.json",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

// Instalacija — kesiraj sve bitne fajlove
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_IME).then((cache) => {
      return cache.addAll(KESIRAJ_PRI_INSTALACIJI).catch((err) => {
        console.warn("Neki fajlovi nisu kessirani:", err);
      });
    })
  );
  self.skipWaiting();
});

// Aktivacija — obrisi stare cache verzije
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((kljucevi) => {
      return Promise.all(
        kljucevi
          .filter((k) => k !== CACHE_IME)
          .map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch — Cache first, network fallback
self.addEventListener("fetch", (event) => {
  // Firebase i eksterni API pozivi — uvek mreza, nikad cache
  const url = event.request.url;
  if (
    url.includes("firestore.googleapis.com") ||
    url.includes("firebase") ||
    url.includes("gstatic.com/firebasejs")
  ) {
    return; // prepusti browseru
  }

  event.respondWith(
    caches.match(event.request).then((kesiran) => {
      if (kesiran) return kesiran;

      // Nije u cache — pokusaj mreza pa kesiraj
      return fetch(event.request)
        .then((odgovor) => {
          if (!odgovor || odgovor.status !== 200 || odgovor.type === "opaque") {
            return odgovor;
          }
          const klon = odgovor.clone();
          caches.open(CACHE_IME).then((cache) => {
            cache.put(event.request, klon);
          });
          return odgovor;
        })
        .catch(() => {
          // Offline fallback za HTML stranice
          if (event.request.destination === "document") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
