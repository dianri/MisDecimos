import { supabase } from '../../lib/supabase'

export type PlatformType = 'android' | 'ios' | 'desktop'

/**
 * Convierte una clave pública VAPID en Base64 a Uint8Array.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Detecta la plataforma del dispositivo actual.
 */
export function detectPlatform(): PlatformType {
  const userAgent = navigator.userAgent || navigator.vendor || ''
  if (/android/i.test(userAgent)) {
    return 'android'
  }
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream) {
    return 'ios'
  }
  return 'desktop'
}

/**
 * Comprueba si la aplicación está ejecutándose en modo instalado (PWA standalone).
 */
export function isStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/**
 * Verifica si el navegador soporta Web Push API y Service Worker.
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Obtiene el estado actual del permiso de notificaciones.
 */
export function getNotificationPermissionState(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied'
  }
  return Notification.permission
}

/**
 * Suscribe al usuario actual a las notificaciones Web Push nativas.
 */
export async function subscribeUserToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('Web Push no soportado en este navegador')
    return false
  }

  // En iOS, las notificaciones Web Push requieren estar en modo standalone (Añadido a pantalla de inicio)
  const platform = detectPlatform()
  if (platform === 'ios' && !isStandaloneMode()) {
    alert(
      'En iOS (iPhone/iPad), debes añadir MisDecimos a la pantalla de inicio para habilitar las notificaciones push.'
    )
    return false
  }

  try {
    // 1. Solicitar permiso al usuario
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return false
    }

    // 2. Obtener registro del Service Worker
    const registration = await navigator.serviceWorker.ready
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

    let subscription: PushSubscription | null = null

    if (vapidKey) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidKey)
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      })
    } else {
      console.warn(
        '⚠️ VITE_VAPID_PUBLIC_KEY no configurada. Intentando suscripción genérica o registrando permiso en perfil.'
      )
      // Si aún no hay clave VAPID en .env, actualizamos al menos el perfil para reflejar la intención
      await supabase
        .from('profiles')
        .update({ push_enabled: true, updated_at: new Date().toISOString() })
        .eq('id', userId)
      return true
    }

    if (!subscription) {
      return false
    }

    // 3. Extraer claves de suscripción
    const p256dhKey = subscription.getKey('p256dh')
    const authKey = subscription.getKey('auth')

    if (!p256dhKey || !authKey) {
      return false
    }

    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))))
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))))

    // 4. Guardar en public.web_push_subscriptions
    const { error: subError } = await supabase
      .from('web_push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          platform,
          user_agent: navigator.userAgent,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )

    if (subError) {
      console.error('Error guardando suscripción push:', subError)
      return false
    }

    // 5. Actualizar bandera push_enabled en el perfil del usuario
    await supabase
      .from('profiles')
      .update({ push_enabled: true, updated_at: new Date().toISOString() })
      .eq('id', userId)

    return true
  } catch (err) {
    console.error('Error al suscribir a notificaciones push:', err)
    return false
  }
}

/**
 * Desactiva y desuscribe las notificaciones Web Push para el usuario actual.
 */
export async function unsubscribeUserFromPush(userId: string): Promise<boolean> {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        // Marcar inactivo en BD
        await supabase
          .from('web_push_subscriptions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('endpoint', subscription.endpoint)
      }
    }

    // Actualizar perfil
    await supabase
      .from('profiles')
      .update({ push_enabled: false, updated_at: new Date().toISOString() })
      .eq('id', userId)

    return true
  } catch (err) {
    console.error('Error al desuscribir notificaciones push:', err)
    return false
  }
}
