// Service worker kill switch.
// We previously cached '/' (index.html) which can cause blank screens after deploys
// when index.html references old hashed asset filenames.
// This SW clears all caches and unregisters itself.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch (e) {
        // ignore
      }

      try {
        await self.registration.unregister();
      } catch (e) {
        // ignore
      }

      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        try {
          client.navigate(client.url);
        } catch (e) {
          // ignore
        }
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // Passthrough: do not cache or intercept.
  return;
});
