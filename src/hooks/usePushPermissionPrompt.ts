import { useState, useEffect, useRef, useCallback } from 'react'
import type { Profile } from '../context/AuthContext'
import {
  isPushSupported,
  getNotificationPermissionState,
  subscribeUserToPush,
} from '../services/push/pushSubscription'

export type PushPromptContext = 'onboarding' | 'unread_alert'

export const getDismissalsKey = (userId: string) =>
  `misdecimos_push_prompt_dismissals_${userId}`

export const getSessionKey = (userId: string) =>
  `misdecimos_push_prompt_asked_session_${userId}`

export const getRespondedKey = (userId: string) =>
  `misdecimos_push_prompt_responded_${userId}`

export function getPushPromptDismissals(userId: string): number {
  if (typeof window === 'undefined') return 0
  const raw = localStorage.getItem(getDismissalsKey(userId))
  const parsed = parseInt(raw || '0', 10)
  return isNaN(parsed) ? 0 : parsed
}

export function resetPushPromptDismissals(userId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getDismissalsKey(userId), '0')
}

export function incrementPushPromptDismissals(userId: string): number {
  if (typeof window === 'undefined') return 0
  const current = getPushPromptDismissals(userId)
  const next = current + 1
  localStorage.setItem(getDismissalsKey(userId), next.toString())
  return next
}

interface UsePushPermissionPromptProps {
  userId?: string
  profile?: Profile | null
  unreadCount?: number
  refreshProfile?: () => Promise<void>
  isBlocked?: boolean
}

export function usePushPermissionPrompt({
  userId,
  profile,
  unreadCount = 0,
  refreshProfile,
  isBlocked = false,
}: UsePushPermissionPromptProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [promptContext, setPromptContext] = useState<PushPromptContext>('onboarding')
  const [showDismissToast, setShowDismissToast] = useState(false)
  const [isActivating, setIsActivating] = useState(false)

  const dismissToastTimerRef = useRef<number | null>(null)

  // Disparadores automáticos: primera entrada y notificaciones no leídas
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    if (isBlocked) return

    // Si no está soportado en el navegador, abortar
    if (!isPushSupported()) return

    // Comprobar estado nativo del permiso en el navegador
    const permission = getNotificationPermissionState()
    if (permission === 'denied') return

    // Si ya está activo en navegador y en perfil, o el usuario ya respondió con permiso concedido, no preguntar
    if (permission === 'granted' && (profile?.push_enabled || localStorage.getItem(getRespondedKey(userId)) === 'true')) {
      return
    }

    // Comprobar si ya se preguntó en esta sesión
    const sessionAsked = sessionStorage.getItem(getSessionKey(userId))
    if (sessionAsked) return

    // Comprobar número de cancelaciones previas (límite de 3)
    const dismissals = getPushPromptDismissals(userId)
    if (dismissals >= 3) return

    // Disparador 1: Primera entrada (dismissals === 0) tras 1.5s
    if (dismissals === 0) {
      const timer = window.setTimeout(() => {
        if (
          getNotificationPermissionState() !== 'granted' &&
          !sessionStorage.getItem(getSessionKey(userId))
        ) {
          setPromptContext('onboarding')
          setIsOpen(true)
          sessionStorage.setItem(getSessionKey(userId), 'true')
        }
      }, 1500)

      return () => clearTimeout(timer)
    }

    // Disparador 2: Notificación recibida sin permisos de push (unreadCount > 0 y dismissals < 3)
    if (unreadCount > 0 && dismissals < 3) {
      setPromptContext('unread_alert')
      setIsOpen(true)
      sessionStorage.setItem(getSessionKey(userId), 'true')
    }
  }, [userId, profile?.push_enabled, unreadCount, isBlocked])

  // Manejo de cancelación ("Ahora no" o botón "X")
  const handleDismiss = useCallback(() => {
    if (!userId) {
      setIsOpen(false)
      return
    }

    // Incrementar contador de cancelaciones
    incrementPushPromptDismissals(userId)
    sessionStorage.setItem(getSessionKey(userId), 'true')
    setIsOpen(false)

    // Mostrar toast informativo durante 5 segundos
    setShowDismissToast(true)
    if (dismissToastTimerRef.current) {
      clearTimeout(dismissToastTimerRef.current)
    }
    dismissToastTimerRef.current = window.setTimeout(() => {
      setShowDismissToast(false)
      dismissToastTimerRef.current = null
    }, 5000)
  }, [userId])

  // Manejo de activación con cierre garantizado (try / catch / finally)
  const handleActivate = useCallback(async () => {
    if (!userId) {
      setIsOpen(false)
      return
    }

    setIsActivating(true)
    try {
      const success = await subscribeUserToPush(userId)
      const permission = getNotificationPermissionState()

      if (permission === 'granted') {
        localStorage.setItem(getRespondedKey(userId), 'true')
        sessionStorage.setItem(getSessionKey(userId), 'true')
        resetPushPromptDismissals(userId)
        setIsOpen(false)
        if (success && refreshProfile) {
          await refreshProfile()
        }
      } else {
        // Si no se concedió el permiso o fue cancelado
        handleDismiss()
      }
    } catch (err) {
      console.warn('Error o timeout al activar push desde modal:', err)
      if (getNotificationPermissionState() === 'granted') {
        localStorage.setItem(getRespondedKey(userId), 'true')
        sessionStorage.setItem(getSessionKey(userId), 'true')
        setIsOpen(false)
      } else {
        handleDismiss()
      }
    } finally {
      setIsActivating(false)
      setIsOpen(false)
    }
  }, [userId, refreshProfile, handleDismiss])

  const closeDismissToast = useCallback(() => {
    setShowDismissToast(false)
    if (dismissToastTimerRef.current) {
      clearTimeout(dismissToastTimerRef.current)
      dismissToastTimerRef.current = null
    }
  }, [])

  return {
    isPromptOpen: isOpen,
    promptContext,
    isActivating,
    showDismissToast,
    handleActivate,
    handleDismiss,
    closeDismissToast,
  }
}
