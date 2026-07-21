/* The Arbiter — service worker: instant launches, full offline shell.
   Bump the version to force a refresh of everything precached below. */
const CACHE = "arbiter-shell-v1";
const SHELL = [
  "./", "./index.html", "./icon.svg", "./site.webmanifest",
  "./favicon-16.png", "./favicon-32.png", "./favicon-48.png",
  "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;              // never touch API calls
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;                  // e.g. api.anthropic.com passes through

  /* The app itself: network-first so new releases arrive immediately,
     cached copy when offline. */
  if (e.request.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    e.respondWith(
      fetch(e.request).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put("./index.html", cp));
        return r;
      }).catch(() =>
        caches.match("./index.html").then(r => r || caches.match("./"))
      )
    );
    return;
  }

  /* Icons, manifest, fonts: cache-first with a background refresh. */
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(r => {
        if (r.ok) {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, cp));
        }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
