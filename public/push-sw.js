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
  const ticketId =
    data.ticketId ||
    data.ticket_id ||
    (data.data && (data.data.ticketId || data.data.ticket_id)) ||
    (data.metadata && (data.metadata.ticket_id || data.metadata.ticketId)) ||
    null

  const notificationId =
    data.notificationId ||
    data.notification_id ||
    (data.data && (data.data.notificationId || data.data.notification_id)) ||
    (data.metadata && (data.metadata.notification_id || data.metadata.notificationId)) ||
    null

  const actionUrl =
    data.url ||
    (data.data && data.data.url) ||
    data.actionUrl ||
    (ticketId ? `/billetes/${ticketId}` : '/alertas')

  const options = {
    body: data.body || 'Tienes una nueva notificación en MisDecimos',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || (ticketId ? `misdecimos-ticket-${ticketId}` : 'misdecimos-alert'),
    data: {
      url: actionUrl,
      ticketId,
      ticket_id: ticketId,
      notificationId,
      notification_id: notificationId,
      metadata: data.metadata || (data.data && data.data.metadata) || {},
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const notifData = event.notification.data || {}
  const ticketId = notifData.ticketId || notifData.ticket_id || null
  const notificationId = notifData.notificationId || notifData.notification_id || null
  let targetUrl = notifData.url

  if (!targetUrl) {
    targetUrl = ticketId ? `/billetes/${ticketId}` : '/alertas'
  }

  const resolvedTarget = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      // 1. Si ya hay una ventana activa de MisDecimos (en segundo plano o abierta)
      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus()
          // Enviar mensaje al cliente para navegación React SPA limpia y marcado silencioso de lectura
          if ('postMessage' in client) {
            client.postMessage({
              type: 'PUSH_NOTIFICATION_CLICK',
              url: targetUrl,
              fullUrl: resolvedTarget,
              ticketId,
              notificationId,
            })
          }
          if ('navigate' in client && client.url !== resolvedTarget) {
            await client.navigate(resolvedTarget).catch(() => {})
          }
          return
        }
      }

      // 2. Si la app está cerrada (cold start)
      if (clients.openWindow) {
        return clients.openWindow(resolvedTarget)
      }
    })
  )
})
