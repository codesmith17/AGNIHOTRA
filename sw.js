const CACHE_NAME = 'agnihotra-cache-v5';

// Critical assets to cache on install
const CRITICAL_ASSETS = [
  '/index.html',
  '/script.js',
  '/style.css',
  '/agnihotra-icon.png'
];

// Assets to cache on-demand (as they're fetched)
const CACHEABLE_RESOURCES = [
  '/bell-tone.mp3',
  '/Sunrise Agnihotra Mantra.mp3',
  '/Sunset Agnihotra Mantra.mp3',
  '/68fdb35faa0209f017128af309265ac2_icon.png',
  '/copper-pyramid.jpg',
  '/cow-dung.webp',
  '/cow-ghee.jpg',
  '/unpolished-rice.jpg',
  '/agnihotra-timing.jpg',
  '/1110707675-preview.mp4'
];

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
            if (!networkResponse || networkResponse.status !== 200) {
              console.log(`[SW] Invalid response for ${event.request.url}:`, networkResponse?.status);
              return networkResponse;
            }

            // Clone the response
            const responseToCache = networkResponse.clone();

            // Cache the response for future use
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
              return caches.match('/index.html');
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

