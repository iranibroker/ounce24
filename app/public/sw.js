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

  const title = formattedPrice;
  const timestamp = Date.now();
  const options = {
    body: 'Signal profitability stats coming soon.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'ounce-price-alert', // Updates existing notification instead of creating a new one
    renotify: false, // Prevents subsequent sound/vibration alerts when replacing notification
    silent: true, // Completely silent for frequent 5-second updates (crucial for user comfort)
    data: {
      timestamp: timestamp,
    },
  };

  const notificationPromise = self.registration.showNotification(title, options);

  const closePromise = new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const notifications = await self.registration.getNotifications({
          tag: 'ounce-price-alert',
        });
        for (const notification of notifications) {
          if (notification.data && notification.data.timestamp <= timestamp) {
            notification.close();
          }
        }
      } catch (err) {
        console.error('Error closing notification:', err);
      }
      resolve();
    }, 30000); // 30 seconds
  });

  event.waitUntil(Promise.all([notificationPromise, closePromise]));
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
