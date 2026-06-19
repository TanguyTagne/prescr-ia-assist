const CACHE_NAME = "asclion-v9";
const PRECACHE_URLS = ["/manifest.json", "/favicon.ico"];

const isBackendRequest = (url) =>
  url.includes("/functions/") || url.includes("supabase.co");

const isNavigationRequest = (request) =>
  request.mode === "navigate" || request.destination === "document";

const isDesktopClient = async (event) => {
  if (!event.clientId) return false;
  const client = await self.clients.get(event.clientId);
  return Boolean(client?.url?.includes("desktop=1"));
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  event.respondWith((async () => {
    if (await isDesktopClient(event)) {
      return fetch(request);
    }

    if (isBackendRequest(request.url)) {
      return fetch(request);
    }

    if (isNavigationRequest(request)) {
      try {
        return await fetch(request, { cache: "no-store" });
      } catch {
        return (await caches.match(request)) || Response.error();
      }
    }

    const url = new URL(request.url);
    if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
      return fetch(request, { cache: "no-store" });
    }

    const cached = await caches.match(request);
    const fetched = fetch(request)
      .then((response) => {
        if (response && response.status === 200 && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => cached);

    return cached || fetched;
  })());
});
