// push-sw.js — Soporte de eventos Web Push nativos en el Service Worker de MisDecimos

self.addEventListener('push', (event) => {
  let data = {}
  try {
    if (event.data) {
      data = event.data.json()
    }
  } catch (err) {
    console.error('Error parseando payload de notificación push:', err)
    data = {
      title: 'MisDecimos',
      body: event.data ? event.data.text() : 'Tienes una nueva notificación en MisDecimos',
    }
  }

  const title = data.title || 'MisDecimos'
  const options = {
    body: data.body || '',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/badge-mono.png',
    tag: data.tag || 'misdecimos-notification',
    data: {
      url: data.url || data.actionUrl || '/',
      metadata: data.metadata || {},
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl =
    (event.notification.data &&
      (event.notification.data.url || event.notification.data.actionUrl)) ||
    '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si ya hay una ventana abierta, enfocarla y navegar a la URL
      for (const client of windowClients) {
        if ('focus' in client) {
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl)
          }
          return client.focus()
        }
      }
      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
