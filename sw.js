/**
 * 小满 · 离线缓存
 * 发版时只需修改 CACHE_VERSION；旧缓存会在 activate 时清理。
 */

const CACHE_VERSION = "1.0.0";
const CACHE_NAME = `xiaoman-shell-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/styles.css",
  "./assets/app.js",
  "./assets/date.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("xiaoman-shell-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirstWithRefresh(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const networkResponse = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cachedResponse) return cachedResponse;
  return networkResponse;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          const response = await fetch(request);
          if (response && response.ok) {
            cache.put("./index.html", response.clone());
          }
          return response;
        } catch {
          return (
            (await cache.match(request)) ||
            (await cache.match("./index.html")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  event.respondWith(cacheFirstWithRefresh(request));
});
