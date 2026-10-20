/* Generated as sw.js by npm run build. Updates activate after old tabs close. */
"use strict";
const VERSION = "d20fbfd569719f65d145";
const FILES = [
  "./index.html",
  "./styles.css",
  "./game.js",
  "./offline.js",
  "./manifest.webmanifest",
  "./assets/wolf-pos-1.webp",
  "./assets/wolf-pos-2.webp",
  "./assets/wolf-pos-3.webp",
  "./assets/wolf-pos-4.webp",
  "./assets/icon-180.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];
const PREFIX = `wolf-game:${self.registration.scope}:`;
const CACHE = `${PREFIX}${VERSION}`;
const urls = FILES.map((file) => new URL(file, self.registration.scope).href);
const indexURL = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll is atomic: a missing frame must never yield a ready installation.
    await cache.addAll(urls.map((url) => new Request(url, { cache: "reload" })));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  url.search = "";
  const key = (url.href === scope.href || url.href === indexURL) ? indexURL : url.href;
  if (!urls.includes(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(key) || fetch(event.request);
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CHECK_OFFLINE_READY" || !event.ports[0]) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let resources = await Promise.all(urls.map((url) => cache.match(url)));
    const missing = urls.filter((url, index) => !resources[index]);
    if (missing.length) {
      try {
        await cache.addAll(missing.map((url) => new Request(url, { cache: "reload" })));
        resources = await Promise.all(urls.map((url) => cache.match(url)));
      } catch { /* Report not-ready if resources cannot be restored. */ }
    }
    event.ports[0].postMessage({ offlineReady: resources.every(Boolean), version: VERSION });
  })());
});
