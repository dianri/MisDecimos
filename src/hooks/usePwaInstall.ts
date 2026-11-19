import { useState, useEffect, useCallback } from 'react'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null
  }
}

export type PwaDevicePlatform = 'android' | 'ios' | 'desktop'

/**
 * Detecta de forma fiable si la aplicación está ejecutándose en modo nativo/standalone.
 * Comprueba display-mode: standalone y navigator.standalone, evitando confiar en claves
 * caducadas de localStorage que persistirían tras una desinstalación.
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean })?.standalone === true ||
    (typeof document !== 'undefined' && Boolean(document.referrer?.startsWith('android-app://')))
  )
}

/**
 * Detecta la plataforma del dispositivo para adaptar las instrucciones de instalación manual.
 */
export function detectDevicePlatform(customNav?: {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
}): PwaDevicePlatform {
  if (typeof window === 'undefined' && !customNav) return 'desktop'
  const nav = customNav || (typeof window !== 'undefined' ? window.navigator : undefined)
  if (!nav) return 'desktop'

  const ua = nav.userAgent || ''
  const platform = nav.platform || ''
  const maxTouchPoints = nav.maxTouchPoints || 0

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === 'MacIntel' && maxTouchPoints > 1) ||
    (/Macintosh/.test(ua) && maxTouchPoints > 1)

  if (isIOS) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

export interface UsePwaInstallReturn {
  isStandalone: boolean
  hasNativePrompt: boolean
  isInstallable: boolean
  platform: PwaDevicePlatform
  deferredPrompt: BeforeInstallPromptEvent | null
  installApp: () => Promise<boolean>
  isInstructionModalOpen: boolean
  openInstructionsModal: () => void
  closeInstructionsModal: () => void
}

/**
 * Hook para la gestión integral y fiable de la instalación PWA.
 * Consume la captura global de window.__deferredPwaPrompt inicializada en el arranque
 * y ofrece fallback guiado mediante modal de instrucciones si el prompt nativo no está disponible.
 */
export function usePwaInstall(): UsePwaInstallReturn {
  const [isStandalone, setIsStandalone] = useState<boolean>(() => isStandaloneMode())
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__deferredPwaPrompt) {
      return window.__deferredPwaPrompt
    }
    return null
  })
  const [platform] = useState<PwaDevicePlatform>(() => detectDevicePlatform())
  const [isInstructionModalOpen, setIsInstructionModalOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Escuchar cambios dinámicos en display-mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches || isStandaloneMode())
    }
    mediaQuery.addEventListener('change', handleMediaChange)

    // Capturar beforeinstallprompt si se emite tras el montaje
    const handlePrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      window.__deferredPwaPrompt = promptEvent
      setDeferredPrompt(promptEvent)
    }

    // Capturar evento custom disparado en arranque o por otros componentes
    const handleCustomPromptReady = () => {
      if (window.__deferredPwaPrompt) {
        setDeferredPrompt(window.__deferredPwaPrompt)
      }
    }

    // Escuchar cuando la app se instala con éxito
    const handleAppInstalled = () => {
      window.__deferredPwaPrompt = null
      setDeferredPrompt(null)
      setIsStandalone(true)
      setIsInstructionModalOpen(false)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('pwa-deferred-prompt-ready', handleCustomPromptReady)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Si ya existe prompt global guardado y el estado local estaba nulo
    if (window.__deferredPwaPrompt && !deferredPrompt) {
      setDeferredPrompt(window.__deferredPwaPrompt)
    }

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange)
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('pwa-deferred-prompt-ready', handleCustomPromptReady)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [deferredPrompt])

  const installApp = useCallback(async (): Promise<boolean> => {
    const prompt = deferredPrompt || window.__deferredPwaPrompt
    if (prompt) {
      try {
        await prompt.prompt()
        const choice = await prompt.userChoice
        if (choice.outcome === 'accepted') {
          window.__deferredPwaPrompt = null
          setDeferredPrompt(null)
          setIsInstructionModalOpen(false)
          return true
        }
        return false
      } catch (err) {
        console.warn('Error ejecutando prompt nativo de instalación PWA:', err)
        setIsInstructionModalOpen(true)
        return false
      }
    } else {
      // Prompt no disponible (enfriamiento de Chrome Android tras desinstalar o iOS Safari)
      setIsInstructionModalOpen(true)
      return false
    }
  }, [deferredPrompt])

  const openInstructionsModal = useCallback(() => {
    setIsInstructionModalOpen(true)
  }, [])

  const closeInstructionsModal = useCallback(() => {
    setIsInstructionModalOpen(false)
  }, [])

  return {
    isStandalone,
    hasNativePrompt: !!deferredPrompt,
    isInstallable: !isStandalone,
    platform,
    deferredPrompt,
    installApp,
    isInstructionModalOpen,
    openInstructionsModal,
    closeInstructionsModal,
  }
}
