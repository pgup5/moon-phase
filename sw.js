const CACHE_PREFIX = `moon-phase:${self.registration.scope}:`;
const CACHE = `${CACHE_PREFIX}v39`;
const ASSETS = [
  "./", "index.html", "css/style.css", "manifest.webmanifest",
  "js/app.js", "js/moon-link.js", "js/moonrise-countdown.js", "js/moonrise-camera.js", "js/festival-countdown.js", "js/storage.js", "js/date-range.js", "js/viewing-advice.js", "js/lunar-eclipse.js", "js/eclipse-feature.js", "js/observing.js", "js/observing-features.js", "js/night-sky.js", "js/night-features.js", "vendor/astronomy.js", "js/mobile-layout.js", "js/photo-guide.js", "js/landscape.js", "js/moon-explorer.js", "js/exploration-tools.js", "js/astro.js", "js/culture.js", "js/daily-poems.js", "js/sky.js", "js/moon3d.js", "js/card.js", "js/launches.js", "js/viewing-score.js", "js/moon-path.js", "js/viewing-week.js", "js/i18n.js", "js/en.js",
  "vendor/three.module.min.js", "textures/moon_color_2k.jpg", "textures/moon_disp_1k.jpg",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];
// Resolve against the worker scope, independently of the current document/query.
const APP_URL = new URL(self.registration.scope);
const ASSET_URLS = ASSETS.map((path) => new URL(path, APP_URL).href);
const ASSET_SET = new Set(ASSET_URLS);
self.addEventListener("install", (e) => {
  // A failed precache leaves the previous worker active.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSET_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
// Stale-while-revalidate only the app shell and known static assets. Query
// parameters remain in the address bar; they do not create duplicate shell entries.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  url.search = "";
  url.hash = "";
  if (!ASSET_SET.has(url.href)) return;
  const key = url.href === APP_URL.href ? new URL("index.html", APP_URL).href : url.href;
  const network = caches.open(CACHE).then(async (cache) => {
    const response = await fetch(e.request);
    if (response.ok && response.type !== "opaque") await cache.put(key, response.clone());
    return response;
  });
  // Keep refresh/cache writes alive even when a cached response returns first.
  e.waitUntil(network.then(() => {}, () => {}));
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(key);
    return hit || network;
  }));
});
