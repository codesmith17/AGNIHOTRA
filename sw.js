const CACHE_NAME = 'agnihotra-cache-v26';

// Critical assets to cache on install
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/translations.json',
  '/notifications.js',
  '/shared/notifications/core.js',
  '/adapters/web/notifications.adapter.js',
  '/adapters/android/notifications.adapter.js',
  '/timings-engine.js',
  '/script.js',
  '/style.css',
  '/assets/images/app-icon-192.png',
  '/assets/images/app-icon.png'
];

// Assets to cache on-demand (as they're fetched)
const CACHEABLE_RESOURCES = [
  '/assets/audio/alerts/agnihotra-single-bell.mp3',
  '/assets/audio/alerts/agnihotra-bell-3x.mp3',
  '/assets/audio/mantras/sunrise-mantra.mpeg',
  '/assets/audio/mantras/sunset-mantra.mpeg',
  '/assets/audio/mantras/panchasheel-pratidnya.mpeg',
  '/assets/audio/mantras/saptashloki.mpeg',
  '/assets/audio/mantras/trisatya-sharanagati.mpeg',
  '/assets/images/eternalagni-icon.png',
  '/assets/images/copper-pyramid.jpg',
  '/assets/images/cow-dung-cakes.webp',
  '/assets/images/cow-ghee.jpg',
  '/assets/images/unpolished-rice-grains.jpg',
  '/assets/images/agnihotra-timing-reference.jpg',
  '/assets/video/fire-background.mp4'
];

function buildOfflineRecoveryPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EternalAgni Recovery</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #0f0f12; color: #fff; display: grid; place-items: center; min-height: 100vh; }
    .card { width: min(92vw, 520px); background: #18181d; border: 1px solid #2a2a33; border-radius: 14px; padding: 24px; box-shadow: 0 16px 40px rgba(0,0,0,0.35); }
    h1 { margin: 0 0 10px; font-size: 1.4rem; }
    p { margin: 0 0 16px; opacity: 0.9; line-height: 1.45; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; }
    button { border: 0; border-radius: 9px; padding: 10px 14px; font-weight: 600; cursor: pointer; }
    #fix { background: #ff7f32; color: #111; }
    #reload { background: #2a2a33; color: #fff; border: 1px solid #3a3a45; }
    small { display: block; margin-top: 14px; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="card">
    <h1>App Recovery Needed</h1>
    <p>The app could not load required files. Use <b>Fix App</b> once to clear old cache/service worker and reload.</p>
    <div class="row">
      <button id="fix">Fix App</button>
      <button id="reload">Reload</button>
    </div>
    <small>If internet is unstable, try again after a few seconds.</small>
  </div>
  <script>
    document.getElementById('reload').onclick = () => location.reload();
    document.getElementById('fix').onclick = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (_) {}
      location.reload();
    };
  </script>
</body>
</html>`;
}

// Install event - only cache critical assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching critical assets');
        // Try to cache critical assets, but don't fail if some don't work
        return Promise.allSettled(
          CRITICAL_ASSETS.map(url => 
            cache.add(url)
              .then(() => console.log(`[SW] Cached: ${url}`))
              .catch(err => console.warn(`[SW] Failed to cache ${url}:`, err.message))
          )
        );
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Install failed:', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network, cache on success
self.addEventListener('fetch', (event) => {
  // Skip non-http/https requests (like chrome-extension://)
  if (!event.request.url.startsWith('http')) {
    return;
  }

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isAudioRequest =
    event.request.destination === 'audio' ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.mpeg');
  
  // Skip API calls from caching logic
  const isApiCall = 
    url.hostname.includes('bigdatacloud.net') ||
    url.hostname.includes('nominatim.openstreetmap.org') ||
    url.hostname.includes('homatherapie.de');

  if (isApiCall) {
    // For API calls, just pass through to network
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Network unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Browsers may request /favicon.ico even with explicit icon links.
  // Return app icon fallback instead of surfacing a 503 error.
  if (isSameOrigin && url.pathname === '/favicon.ico') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/assets/images/app-icon.png').then((iconResponse) => {
          return (
            iconResponse ||
            new Response(null, {
              status: 204,
              statusText: 'No Content'
            })
          );
        })
      )
    );
    return;
  }

  // For document navigations, prefer network but always fall back to app shell.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        Promise.all([caches.match('/index.html'), caches.match('/')]).then(([cachedIndex, cachedRoot]) => {
          return (
            cachedIndex ||
            cachedRoot ||
            new Response(buildOfflineRecoveryPage(), {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            })
          );
        })
      )
    );
    return;
  }

  // For audio files, use network-first so updated mantra files are not stuck in old cache.
  if (isAudioRequest) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const isValidResponse = networkResponse && (
            (networkResponse.status >= 200 && networkResponse.status < 300) ||
            networkResponse.status === 206 ||
            networkResponse.type === 'opaque'
          );

          if (isValidResponse && networkResponse.status !== 206 && networkResponse.type !== 'opaque') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch(() => {});
            });
          }

          return networkResponse;
        })
        .catch(() =>
          caches.match(event.request).then((cachedResponse) => {
            // Always return a valid Response object for failed audio fetches.
            return (
              cachedResponse ||
              new Response('', {
                status: 503,
                statusText: 'Service Unavailable',
              })
            );
          })
        )
    );
    return;
  }

  // For all other requests, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache, try network
        console.log('[SW] Fetching from network:', event.request.url);
        return fetch(event.request)
          .then((networkResponse) => {
            // Check if valid response
            // Accept: 200-299 (success), 206 (partial content for media), or opaque responses (status 0 from CORS)
            const isValidResponse = networkResponse && (
              (networkResponse.status >= 200 && networkResponse.status < 300) ||
              networkResponse.status === 206 ||
              networkResponse.type === 'opaque'
            );

            if (!isValidResponse) {
              console.log(`[SW] Invalid response for ${event.request.url}:`, networkResponse?.status);
              return networkResponse;
            }

            // Don't cache partial content (206) or opaque responses - just return them
            if (networkResponse.status === 206 || networkResponse.type === 'opaque') {
              console.log(`[SW] Not caching ${networkResponse.status === 206 ? 'partial content' : 'opaque response'}:`, event.request.url);
              return networkResponse;
            }

            // Clone the response
            const responseToCache = networkResponse.clone();

            // Cache the response for future use (only for status 200-299)
            caches.open(CACHE_NAME)
              .then((cache) => {
                console.log('[SW] Caching:', event.request.url);
                cache.put(event.request, responseToCache).catch(err => {
                  console.warn('[SW] Failed to cache:', event.request.url, err.message);
                });
              });

            return networkResponse;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', event.request.url, error.message);
            
            // For navigation requests (HTML pages), try to return cached index.html
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html').then((cachedIndex) => {
                return (
                  cachedIndex ||
                  new Response('Offline - App shell not available', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'text/plain' },
                  })
                );
              });
            }
            
            // For other resources, return a generic error response
            return new Response('Offline - Resource not available', { 
              status: 503, 
              statusText: 'Service Unavailable' 
            });
          });
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/index.html');
      }
    })
  );
});

