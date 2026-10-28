const CACHE = "moon-v10";
const ASSETS = [
  "./", "index.html", "css/style.css", "manifest.webmanifest",
  "js/app.js", "js/astro.js", "js/culture.js", "js/sky.js", "js/moon3d.js", "js/card.js", "js/launches.js", "js/viewing-score.js", "js/moon-path.js", "js/viewing-week.js",
  "vendor/three.module.min.js", "textures/moon_color_2k.jpg", "textures/moon_disp_1k.jpg",
  "icons/icon-192.png", "icons/icon-512.png",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Stale-while-revalidate: instant offline loads, refreshed in the background.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
