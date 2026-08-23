/* AI Workspace Pro — deployment-root aware service worker.
 *
 * The same source must work on:
 *   - GitHub Pages project sites: /ai-workspace-pro/
 *   - A domain root: /
 *
 * The worker derives its scope from self.registration.scope, so no hostname or
 * project-path is hard-coded here.
 */

const BASE_PATH = new URL('./', self.registration.scope).pathname;
const CACHE_NAME = 'aiwp-static-v3';
const RUNTIME_CACHE = 'aiwp-runtime-v3';

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

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

function inScope(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(BASE_PATH);
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS.map(scopedUrl)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('aiwp-') && key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isStaticRequest(request) {
  if (request.method !== 'GET') return false;
  return inScope(new URL(request.url));
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (!isStaticRequest(request)) return;

  const url = new URL(request.url);
  const isNavigation = request.mode === 'navigate';
  const isApi = /\/api(?:\/|$)|\/v1(?:\/|$)/i.test(url.pathname.slice(BASE_PATH.length));

  if (isApi) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(isNavigation ? networkFirst(request, CACHE_NAME) : cacheFirst(request, CACHE_NAME));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const fallback = await caches.match(scopedUrl('./index.html'));
      if (fallback) return fallback;
    }

    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
