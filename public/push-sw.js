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
  const actionUrl = data.url || (data.data && data.data.url) || data.actionUrl || '/alertas'
  const options = {
    body: data.body || 'Tienes una nueva notificación en MisDecimos',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'misdecimos-notification',
    data: {
      url: actionUrl,
      metadata: data.metadata || (data.data && data.data.metadata) || {},
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    '/alertas'

  const resolvedTarget = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if ('navigate' in client && client.url !== resolvedTarget) {
            client.navigate(resolvedTarget)
          }
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(resolvedTarget)
      }
    })
  )
})
