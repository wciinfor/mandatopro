const CACHE_NAME = 'disparo-pro-v2.2.0'; // Altere a versão aqui para forçar update
const urlsToCache = [
  './index.html',
  './frontend/js/main.js',
  './frontend/js/auth.js',
  './frontend/js/navigation.js',
  './frontend/js/ui.js',
  './frontend/js/app.js',
  './frontend/js/services/notification.service.js',
  './frontend/js/services/storage.service.js',
  './frontend/js/services/http.service.js',
  './frontend/js/services/n8n.service.js',
  './frontend/js/services/supabase.service.js',
  './frontend/js/services/api.service.js',
  './frontend/js/modules/integrations.js',
  './frontend/js/modules/dashboard.js',
  './frontend/js/modules/contacts.js',
  './frontend/js/modules/reports.js',
  './frontend/js/modules/profile.js',
  './frontend/js/modules/settings.js',
  './frontend/js/modules/instances.js',
  './frontend/js/modules/campaigns.js',
  './frontend/css/layout.css',
  './config/manifest.json',
  './frontend/assets/img/logo.png',
  './frontend/assets/img/icon-192.png',
  './frontend/assets/img/icon-512.png',
  // CDNs importantes
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.10.0/font/bootstrap-icons.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install - instala nova versão
self.addEventListener('install', event => {
  console.log('SW: Installing new version...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('SW: Installation complete');
        // Força ativação imediata da nova versão
        return self.skipWaiting();
      })
  );
  self.skipWaiting();
});

// Activate - limpa cache antigo
self.addEventListener('activate', event => {
  console.log('SW: Activating new version...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Activation complete');
      // Toma controle de todas as abas imediatamente
      return self.clients.claim();
    })
  );
  // ✅ Controlar clientes imediatamente
  return self.clients.claim();
});

// Fetch - serve arquivos do cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se está no cache, retorna. Senão, busca da rede
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
      )
  );
});

// Mensagem para o cliente quando há nova versão
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});