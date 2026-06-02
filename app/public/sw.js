self.addEventListener('install', function (event) {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim()); // Force active service worker to take control of all open clients
});

self.addEventListener('push', function (event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { price: event.data.text() };
    }
  }

  const price = data.price || '---';

  // Format the price as USD (e.g. $2,450.50)
  let formattedPrice = price;
  if (!isNaN(price) && Number(price) > 0) {
    formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(price));
  }

  const title = `XAUUSD: ${formattedPrice}`;
  const options = {
    body: 'Signal profitability stats coming soon.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'ounce-price-alert', // Updates existing notification instead of creating a new one
    renotify: false, // Prevents subsequent sound/vibration alerts when replacing notification
    silent: true, // Completely silent for frequent 5-second updates (crucial for user comfort)
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  // Try to find an open tab and focus it, or open a new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    }),
  );
});
