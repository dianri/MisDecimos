import { useState, useEffect, useCallback } from 'react'

export type PwaPlatform = 'chromium' | 'ios' | 'macos-safari' | 'desktop-other'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export const PWA_PROMPT_COUNT_KEY = 'misdecimos_pwa_install_prompt_count'
export const PWA_INSTALLED_KEY = 'misdecimos_pwa_installed'
export const PWA_SESSION_SHOWN_KEY = 'misdecimos_pwa_prompt_shown_session'
export const PWA_DISMISSED_KEY = 'misdecimos_pwa_prompt_dismissed'

// Captura global de beforeinstallprompt a nivel de módulo para no perder el evento si se dispara antes del render
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    globalDeferredPrompt = e as BeforeInstallPromptEvent
    window.dispatchEvent(new CustomEvent('pwa-deferred-prompt-ready'))
  })

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null
    localStorage.setItem(PWA_INSTALLED_KEY, 'true')
    window.dispatchEvent(new CustomEvent('pwa-installed-event'))
  })
}

/**
 * Obtiene el número de veces que se ha mostrado automáticamente el aviso de instalación.
 */
export function getPwaPromptCount(): number {
  if (typeof window === 'undefined') return 0
  const val = localStorage.getItem(PWA_PROMPT_COUNT_KEY)
  const parsed = parseInt(val || '0', 10)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Reinicia el contador de avisos de instalación PWA.
 */
export function resetPwaPromptCount(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PWA_PROMPT_COUNT_KEY, '0')
}

/**
 * Incrementa en 1 el contador de avisos de instalación PWA.
 */
export function incrementPwaPromptCount(): number {
  if (typeof window === 'undefined') return 0
  const current = getPwaPromptCount()
  const next = current + 1
  localStorage.setItem(PWA_PROMPT_COUNT_KEY, next.toString())
  return next
}

/**
 * Comprueba si el usuario ha descartado definitivamente el aviso automático en este navegador.
 */
export function isPwaPromptPermanentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(PWA_DISMISSED_KEY) === 'true'
}

/**
 * Consulta la API navigator.getInstalledRelatedApps() si está disponible en Chromium/Edge
 * para verificar si la PWA ya ha sido instalada localmente.
 */
export async function checkGetInstalledRelatedApps(customNav?: {
  getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>
}): Promise<boolean> {
  const nav =
    customNav ||
    (typeof window !== 'undefined' && typeof navigator !== 'undefined'
      ? (navigator as unknown as {
          getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>
        })
      : undefined)

  if (typeof nav?.getInstalledRelatedApps === 'function') {
    try {
      const relatedApps = await nav.getInstalledRelatedApps()
      if (Array.isArray(relatedApps) && relatedApps.length > 0) {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem(PWA_INSTALLED_KEY, 'true')
        }
        return true
      }
    } catch (e) {
      console.warn('Error comprobando getInstalledRelatedApps:', e)
    }
  }
  return false
}

/**
 * Comprueba si la aplicación ya está instalada como PWA (modo standalone o previamente registrada).
 */
export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false

  // 1. Flag de instalación previa guardado
  if (localStorage.getItem(PWA_INSTALLED_KEY) === 'true') {
    return true
  }

  // 2. Modo standalone estándar (display-mode: standalone)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true
  }

  // 3. Modo standalone en iOS Safari (navigator.standalone)
  const nav = window.navigator as unknown as { standalone?: boolean }
  if (nav?.standalone === true) {
    return true
  }

  // 4. Android TWA / Webview referrer
  if (typeof document !== 'undefined' && document.referrer?.startsWith('android-app://')) {
    return true
  }

  return false
}

/**
 * Detecta la plataforma y navegador del usuario para ofrecer instrucciones visuales específicas.
 */
export function detectPwaPlatform(customNav?: {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
}): PwaPlatform {
  if (typeof window === 'undefined' && !customNav) return 'desktop-other'

  const nav = customNav || (typeof window !== 'undefined' ? window.navigator : undefined)
  if (!nav) return 'desktop-other'

  const ua = nav.userAgent || ''
  const platform = nav.platform || ''
  const maxTouchPoints = nav.maxTouchPoints || 0

  // 1. iOS e iPadOS (iPhone, iPod, iPad y iPadOS reportando MacIntel con multitouch)
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === 'MacIntel' && maxTouchPoints > 1) ||
    (/Macintosh/.test(ua) && maxTouchPoints > 1)

  if (isIOS) {
    return 'ios'
  }

  // 2. macOS Safari escritorio (sin pantalla táctil)
  const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(platform) || /Mac OS X/.test(ua)
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Brave/.test(ua)
  if (isMac && isSafari && maxTouchPoints <= 1) {
    return 'macos-safari'
  }

  // 3. Android o Navegadores basados en Chromium (Chrome, Edge, Samsung Internet, Brave)
  const isAndroid = /Android/i.test(ua)
  const isChromium = /Chrome|Chromium|Edg|SamsungBrowser|Brave/i.test(ua)
  if (isAndroid || isChromium) {
    return 'chromium'
  }

  return 'desktop-other'
}

export interface UsePwaInstallPromptOptions {
  isBlocked?: boolean
}

export function usePwaInstallPrompt(options?: UsePwaInstallPromptOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [isManualTrigger, setIsManualTrigger] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt)
  const [platform, setPlatform] = useState<PwaPlatform>('desktop-other')
  const [isInstalled, setIsInstalled] = useState(false)

  // Inicializar plataforma, estado de instalación y listeners
  useEffect(() => {
    if (typeof window === 'undefined') return

    setPlatform(detectPwaPlatform())
    setIsInstalled(isPwaInstalled())
    setDeferredPrompt(globalDeferredPrompt)

    // Comprobación asíncrona de app relacionada/instalada en Chromium
    checkGetInstalledRelatedApps().then((installed) => {
      if (installed) {
        setIsInstalled(true)
      }
    })

    const handlePromptReady = () => {
      setDeferredPrompt(globalDeferredPrompt)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsOpen(false)
    }

    const handleManualTrigger = () => {
      setIsManualTrigger(true)
      setIsOpen(true)
    }

    window.addEventListener('pwa-deferred-prompt-ready', handlePromptReady)
    window.addEventListener('pwa-installed-event', handleAppInstalled)
    window.addEventListener('trigger-pwa-install', handleManualTrigger)
    window.addEventListener('open-pwa-install-dialog', handleManualTrigger)

    return () => {
      window.removeEventListener('pwa-deferred-prompt-ready', handlePromptReady)
      window.removeEventListener('pwa-installed-event', handleAppInstalled)
      window.removeEventListener('trigger-pwa-install', handleManualTrigger)
      window.removeEventListener('open-pwa-install-dialog', handleManualTrigger)
    }
  }, [])

  // Disparador automático: solo tras 2.5s, máximo 3 veces, 1 vez por sesión y si no fue descartado definitivamente
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isInstalled || isPwaInstalled()) return
    if (isPwaPromptPermanentlyDismissed()) return
    if (options?.isBlocked) return

    // Comprobar si ya se mostró en esta sesión
    if (sessionStorage.getItem(PWA_SESSION_SHOWN_KEY) === 'true') {
      return
    }

    // Comprobar si ya alcanzó el límite de 3 avisos automáticos
    const count = getPwaPromptCount()
    if (count >= 3) {
      return
    }

    const timer = window.setTimeout(async () => {
      // Re-verificar si fue instalada o descartada mientras corría el timer
      if (isPwaInstalled() || isPwaPromptPermanentlyDismissed() || options?.isBlocked) {
        return
      }

      // En navegadores Chromium, si la PWA ya está instalada, el navegador suprime beforeinstallprompt.
      // NUNCA mostrar el modal automático de tres puntos si deferredPrompt es null en Chromium.
      const currentPlatform = detectPwaPlatform()
      if (currentPlatform === 'chromium' && !globalDeferredPrompt) {
        return
      }

      sessionStorage.setItem(PWA_SESSION_SHOWN_KEY, 'true')
      setIsManualTrigger(false)
      setIsOpen(true)
    }, 2500)

    return () => clearTimeout(timer)
  }, [options?.isBlocked, isInstalled])

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false
    }

    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        localStorage.setItem(PWA_INSTALLED_KEY, 'true')
        setIsInstalled(true)
        setIsOpen(false)
        globalDeferredPrompt = null
        setDeferredPrompt(null)
        return true
      }
      return false
    } catch (err) {
      console.error('Error al solicitar instalación de PWA:', err)
      return false
    }
  }, [deferredPrompt])

  const dismiss = useCallback((permanent = false) => {
    setIsOpen(false)
    sessionStorage.setItem(PWA_SESSION_SHOWN_KEY, 'true')
    if (permanent) {
      localStorage.setItem(PWA_DISMISSED_KEY, 'true')
    } else if (!isManualTrigger) {
      incrementPwaPromptCount()
    }
    setIsManualTrigger(false)
  }, [isManualTrigger])

  const neverShowAgain = useCallback(() => {
    dismiss(true)
  }, [dismiss])

  const openManually = useCallback(() => {
    setIsManualTrigger(true)
    setIsOpen(true)
  }, [])

  return {
    isOpen,
    platform,
    isInstalled,
    hasNativePrompt: Boolean(deferredPrompt),
    isManualTrigger,
    install,
    dismiss,
    neverShowAgain,
    openManually,
  }
}
