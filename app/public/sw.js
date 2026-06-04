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

  // If this is a custom notification payload containing a title or body (e.g. Smart Shield or Signal Follow)
  if (data.title || data.body) {
    const title = data.title || 'Ounce24';
    const options = {
      body: data.body || '',
      icon: data.icon || '/favicon.ico',
      badge: data.badge || '/favicon.ico',
      data: data.data || {},
    };
    if (data.tag) {
      options.tag = data.tag;
    }
    event.waitUntil(self.registration.showNotification(title, options));
    return;
  }

  // Otherwise, it is a gold price update notification (existing behavior)
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
    requireInteraction: true, // Prevents the OS from auto-dismissing the notification
    data: {
      timestamp: timestamp,
    },
  };

  // Save the latest push timestamp in Cache Storage to track if a newer push has arrived
  const saveStatePromise = caches.open('ounce-push-state').then((cache) => {
    return cache.put('https://state.local/last-push', new Response(timestamp.toString()));
  });

  const notificationPromise = self.registration.showNotification(title, options);

  const closePromise = new Promise((resolve) => {
    setTimeout(async () => {
      try {
        // Read the last push timestamp from cache
        const lastPushText = await caches.open('ounce-push-state')
          .then((cache) => cache.match('https://state.local/last-push'))
          .then((res) => (res ? res.text() : '0'));
        const lastPushVal = parseInt(lastPushText, 10);

        // ONLY close if no newer price has been received (lastPushVal is still <= the timestamp of this timeout)
        if (lastPushVal <= timestamp) {
          const notifications = await self.registration.getNotifications({
            tag: 'ounce-price-alert',
          });
          for (const notification of notifications) {
            notification.close();
          }
        }
      } catch (err) {
        console.error('Error closing notification:', err);
      }
      resolve();
    }, 20000); // 20 seconds
  });

  event.waitUntil(Promise.all([saveStatePromise, notificationPromise, closePromise]));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  // Try to find an open tab and focus it, or open a new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'navigate' in client && 'focus' in client) {
          const absoluteUrl = new URL(targetUrl, client.url).href;
          return client.navigate(absoluteUrl).then(() => client.focus());
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
