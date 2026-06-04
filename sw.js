const CACHE_NAME = 'europa2026-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Imagens dos destinos pré-cacheadas para funcionarem 100% offline no exterior
  './plagwitz.jpg',
  './dbfz-center.jpg',
  './bach-leipzig.jpg',
  './uber-arena.jpg',
  './brandenburg.jpg',
  './mauerpark.jpg',
  './currywurst.jpg',
  './doner-kebab.jpg',
  './timisoara-squares.jpg',
  './foss4g.jpg',
  './bega-river.jpg',
  './mici.jpg',
  './sarmale.jpg',
  './papanasi.jpg'
];

// Instalação do Service Worker e Caching dos Arquivos do Shell do App
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pré-cacheando arquivos essenciais...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Ativação e Limpeza de Caches Antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Limpando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepção de Requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Tratar dados ao vivo (câmbio frankfurter.app + clima open-meteo) com Network-First
  if (
    url.hostname === 'frankfurter.app' ||
    url.hostname.endsWith('frankfurter.app') ||
    url.hostname.endsWith('open-meteo.com') ||
    url.pathname.includes('/latest')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Salva uma cópia no cache
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseCopy);
          });
          return response;
        })
        .catch(() => {
          // Se falhar a rede, retorna o cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Estratégia Cache-First com Fallback de Rede para Assets Locais (imagens, fontes, etc.)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Retorna o cacheado e tenta atualizar no fundo (Stale-While-Revalidate para imagens locais)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* Silencia erros offline */});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cacheia novas requisições de assets locais dinamicamente
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Se for uma imagem local, podemos retornar nada ou silenciar
        if (event.request.destination === 'image') {
          return new Response('', { status: 404, statusText: 'Offline Image' });
        }
      });
    })
  );
});
