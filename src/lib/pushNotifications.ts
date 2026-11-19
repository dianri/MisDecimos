import { supabase } from './supabase.ts'

export type PlatformType = 'android' | 'ios' | 'desktop'

/**
 * Convierte una clave pública VAPID en Base64 URL-safe a Uint8Array.
 * Compatible tanto con navegadores (window.atob) como entornos de test Node.js.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData =
    typeof window !== 'undefined' && typeof window.atob === 'function'
      ? window.atob(base64)
      : typeof Buffer !== 'undefined'
      ? Buffer.from(base64, 'base64').toString('binary')
      : ''
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
  if (typeof navigator === 'undefined') return 'desktop'
  const userAgent = navigator.userAgent || navigator.vendor || ''
  if (/android/i.test(userAgent)) {
    return 'android'
  }
  if (
    /iPad|iPhone|iPod/.test(userAgent) &&
    (typeof window === 'undefined' || !(window as unknown as { MSStream?: unknown })?.MSStream)
  ) {
    return 'ios'
  }
  return 'desktop'
}

/**
 * Comprueba si la aplicación está ejecutándose en modo instalado (PWA standalone).
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean })?.standalone === true ||
    (typeof document !== 'undefined' && Boolean(document.referrer?.startsWith('android-app://')))
  )
}

/**
 * Verifica si el navegador y entorno soportan Web Push API y Service Worker.
 */
export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Obtiene el estado actual del permiso de notificaciones de forma segura.
 */
export function getNotificationPermissionState(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }
  return Notification.permission
}

export interface SyncPushResult {
  success: boolean
  subscription?: PushSubscription | null
  error?: string
}

/**
 * Resincroniza silenciosamente la suscripción Web Push en el navegador y Supabase.
 * - Verifica `Notification.permission === 'granted'`.
 * - Obtiene o renueva la suscripción en `registration.pushManager`.
 * - Realiza `upsert` seguro en `public.web_push_subscriptions`.
 * - Actualiza `profiles.push_enabled = true`.
 */
export async function syncPushSubscription(userId: string): Promise<SyncPushResult> {
  if (!isPushSupported()) {
    return { success: false, error: 'Web Push no soportado en este dispositivo o navegador' }
  }

  if (Notification.permission !== 'granted') {
    return { success: false, error: 'Permiso de notificaciones no concedido' }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    const vapidKey =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY) ||
      (typeof process !== 'undefined' ? process.env?.VITE_VAPID_PUBLIC_KEY : '')

    // Si no hay suscripción activa y contamos con la clave VAPID, la creamos
    if (!subscription && vapidKey) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidKey)
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      })
    }

    if (!subscription) {
      return { success: false, error: 'No se pudo generar ni obtener la suscripción PushManager' }
    }

    const p256dhKey = subscription.getKey('p256dh')
    const authKey = subscription.getKey('auth')

    if (!p256dhKey || !authKey) {
      return { success: false, error: 'Claves criptográficas de suscripción no disponibles' }
    }

    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))))
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))))
    const platform = detectPlatform()

    // 1. Upsert en public.web_push_subscriptions
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
      console.error('Error guardando suscripción push en base de datos:', subError)
      return { success: false, error: subError.message }
    }

    // 2. Asegurar bandera push_enabled en el perfil del usuario
    await supabase
      .from('profiles')
      .update({ push_enabled: true, updated_at: new Date().toISOString() })
      .eq('id', userId)

    return { success: true, subscription }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Error en syncPushSubscription:', err)
    return { success: false, error: msg }
  }
}

/**
 * Solicita permisos y suscribe al usuario a notificaciones Web Push nativas.
 */
export async function subscribeUserToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('Web Push no soportado en este navegador')
    return false
  }

  const platform = detectPlatform()
  if (platform === 'ios' && !isStandaloneMode()) {
    alert(
      'En iOS (iPhone/iPad), debes añadir MisDecimos a la pantalla de inicio para habilitar las notificaciones push.'
    )
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return false
    }

    const res = await syncPushSubscription(userId)
    return res.success
  } catch (err) {
    console.error('Error al solicitar permiso o suscribir a push:', err)
    return false
  }
}

/**
 * Desactiva y desuscribe las notificaciones Web Push para el usuario.
 */
export async function unsubscribeUserFromPush(userId: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        await supabase
          .from('web_push_subscriptions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('endpoint', subscription.endpoint)
      }
    }

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
