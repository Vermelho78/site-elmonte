/**
 * Canoa AI — Service Worker
 * Estratégia: Cache-first para assets estáticos, Network-first para API calls.
 * Permite uso básico offline (visualizar treinos já carregados).
 */

const CACHE_NAME = "canoa-ai-v1";

// Assets que serão cacheados imediatamente ao instalar o SW
const PRECACHE_ASSETS = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Rotas que NUNCA devem ser interceptadas (sempre vai para a rede)
const NETWORK_ONLY_PATTERNS = [
  /\/api\/trpc/,
  /\/uploads\//,
];

// --- Instalação: precache dos assets principais ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Precache parcial:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// --- Ativação: remove caches antigos ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// --- Fetch: estratégia híbrida ---
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignora requisições non-GET
  if (event.request.method !== "GET") return;

  // Ignora padrões que devem sempre ir à rede
  const isNetworkOnly = NETWORK_ONLY_PATTERNS.some((p) => p.test(url.pathname));
  if (isNetworkOnly) return;

  // Para assets estáticos: Cache-first
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached || fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  // Para páginas HTML: Network-first com fallback para cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
