// eStories Service Worker — offline shell caching
// WARNING: Cache-first for static assets means new deployments require
// cache-busting via CACHE_NAME version bump.
const CACHE_NAME = "estories-v2";

// App shell: pages and static assets that enable basic offline navigation
const APP_SHELL = [
  "/",
  "/record",
  "/library",
  "/social",
  "/profile",
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API/dynamic, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API routes, auth, and external requests — always network
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // CRITICAL FIX: Skip Next.js RSC payloads.
  // RSC payloads are fetched with ?_rsc= query params during client-side
  // navigation. They are NOT HTML pages and must never be cached or
  // intercepted by the service worker. If fetch() fails and we fall back
  // to caches.match(), the cache won't contain the RSC payload (only HTML
  // pages are cached), causing caches.match() to return undefined and
  // event.respondWith() to throw a NetworkError — breaking navigation.
  if (url.searchParams.has("_rsc")) {
    return;
  }

  // Static assets (JS, CSS, images, fonts): cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Not in cache and network failed — return a synthetic 503 so
          // the browser doesn't see an uncaught NetworkError
          return new Response("Offline — not cached", {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/plain" },
          });
        })
      )
  );
});
