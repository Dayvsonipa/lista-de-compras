const CACHE_NAME = "lista-de-casa-v5";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-rounded-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_APP_SHELL") {
    event.waitUntil(
      fetch("/", { credentials: "include", cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return;
          const htmlResponse = response.clone();
          const html = await response.text();
          const assetUrls = [...html.matchAll(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g)]
            .map((match) => match[1]);
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/", htmlResponse);
          await Promise.all([...new Set(assetUrls)].map((url) => cache.add(url).catch(() => undefined)));
        })
        .catch(() => undefined),
    );
  }

  if (event.data?.type === "CLEAR_PRIVATE_CACHE") {
    event.waitUntil(caches.delete(CACHE_NAME).then(() => caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname === "/") {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match("/")) ?? Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
  }
});
