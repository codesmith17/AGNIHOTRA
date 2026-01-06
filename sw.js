const CACHE_NAME = 'agnihotra-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/script.js',
  '/style.css',
  '/bell-tone.mp3',
  '/Sunrise Agnihotra Mantra.mp3',
  '/Sunset Agnihotra Mantra.mp3',
  '/68fdb35faa0209f017128af309265ac2_icon.png',
  '/copper-pyramid.jpg',
  '/cow-dung.webp',
  '/cow-ghee.jpg',
  '/unpolished-rice.jpg',
  '/agnihotra-timing.jpg',
  '/1110707675-preview.mp4',
  '/favicons/web/icons8-fire-3d-fluency-16.png',
  '/favicons/web/icons8-fire-3d-fluency-32.png',
  '/favicons/web/icons8-fire-3d-fluency-57.png',
  '/favicons/web/icons8-fire-3d-fluency-60.png',
  '/favicons/web/icons8-fire-3d-fluency-70.png',
  '/favicons/web/icons8-fire-3d-fluency-72.png',
  '/favicons/web/icons8-fire-3d-fluency-76.png',
  '/favicons/web/icons8-fire-3d-fluency-96.png',
  'https://icono-49d6.kxcdn.com/icono.min.css',
  'https://use.fontawesome.com/releases/v5.8.1/css/all.css',
  'https://use.fontawesome.com/releases/v5.8.1/webfonts/fa-solid-900.woff2',
  'https://use.fontawesome.com/releases/v5.8.1/webfonts/fa-solid-900.woff',
  'https://use.fontawesome.com/releases/v5.8.1/webfonts/fa-regular-400.woff2',
  'https://use.fontawesome.com/releases/v5.8.1/webfonts/fa-regular-400.woff',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;700&family=Playfair+Display:wght@700&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Use individual add for each to prevent one failure from blocking all
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(url => {
            return cache.add(url).catch(err => console.warn(`Failed to cache ${url}:`, err));
          })
        );
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-http/https requests (like chrome-extension://)
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // If offline and not in cache, return a custom response instead of trying to fetch
        if (!navigator.onLine) {
          return new Response('Offline and not in cache', { status: 503, statusText: 'Service Unavailable' });
        }

        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200) {
              return response;
            }

            // Only cache certain types of responses
            const shouldCache = 
              response.type === 'basic' || // Same-origin
              response.type === 'cors' ||   // CORS-enabled resources (fonts, CDN resources)
              event.request.url.includes('fonts.gstatic.com') ||
              event.request.url.includes('fonts.googleapis.com') ||
              event.request.url.includes('use.fontawesome.com');

            if (!shouldCache) {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                // Don't cache API calls, but DO cache fonts and CDN resources
                const url = event.request.url;
                if (!url.includes('api.bigdatacloud.net') && 
                    !url.includes('nominatim.openstreetmap.org') &&
                    !url.includes('homatherapie.de')) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(() => {
          // Final fallback for actual network failures
          return new Response('Network error occurred', { status: 408, statusText: 'Network Error' });
        });
      })
  );
});

