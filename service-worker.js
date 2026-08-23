/* AI Workspace Pro — Phase 4 PWA service worker */
const CACHE_NAME = 'aiwp-static-v1';
const RUNTIME_CACHE = 'aiwp-runtime-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './404.html',
  './login.html',
  './logout.html',
  './log.html',
  './history.html',
  './assets/css/style.css',
  './assets/css/responsive.css',
  './assets/css/auth.css',
  './assets/js/auth.js',
  './assets/js/spa-router.js',
  './assets/js/api-handler.js',
  './assets/js/request-queue.js',
  './assets/js/error-resilience.js',
  './assets/js/ai-guardrails.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => ![CACHE_NAME, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isStaticRequest(request) {
  return request.method === 'GET' && new URL(request.url).origin === self.location.origin;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (!isStaticRequest(request)) return;

  const url = new URL(request.url);
  const isNavigation = request.mode === 'navigate';
  const isApi = /\/api(?:\/|$)|\/v1(?:\/|$)/i.test(url.pathname);

  if (isApi) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(isNavigation ? networkFirst(request, CACHE_NAME) : cacheFirst(request, CACHE_NAME));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (request.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 503 }));
  }
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
