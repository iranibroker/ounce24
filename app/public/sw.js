// sw version: 2.0
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

  // Otherwise, it is a gold price update notification
  // Using tag + silent + renotify:false ensures each push silently updates
  // the existing notification in-place without flicker or sound.
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
  const options = {
    body: 'Signal profitability stats coming soon.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'ounce-price-alert', // Updates existing notification instead of creating a new one
    renotify: false, // Prevents subsequent sound/vibration alerts when replacing notification
    silent: true, // Completely silent — crucial for real-time price updates
    requireInteraction: true, // Prevents the OS from auto-dismissing the notification
  };

  event.waitUntil(self.registration.showNotification(title, options));
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
