import React, { useState, useEffect } from 'react'
import { isStandaloneMode, detectPlatform } from '../../services/push/pushSubscription'
import { Download, Share, X, PlusSquare } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop'>('desktop')

  useEffect(() => {
    // Si ya está instalada o fue pospuesto en esta sesión, no mostrar
    if (isStandaloneMode() || sessionStorage.getItem('pwa_banner_dismissed') === 'true') {
      return
    }

    const currentPlatform = detectPlatform()
    setPlatform(currentPlatform)

    // Capturar el evento nativo en navegadores Chromium
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // En iOS, como no existe beforeinstallprompt, mostramos la guía si está en navegador móvil
    if (currentPlatform === 'ios') {
      setIsVisible(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice
      if (choiceResult.outcome === 'accepted') {
        setIsVisible(false)
      }
      setDeferredPrompt(null)
    } catch (err) {
      console.error('Error al lanzar la instalación de PWA:', err)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    sessionStorage.setItem('pwa_banner_dismissed', 'true')
  }

  if (!isVisible) return null

  return (
    <aside
      aria-label="Instalación de la aplicación"
      className="mx-4 mt-3 mb-2 rounded-2xl border border-lottery/20 bg-gradient-to-r from-lottery-50 to-emerald-50/70 p-3.5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lottery text-white shadow-sm shadow-lottery/30">
            <Download className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-gray-900">
              Instala MisDecimos en tu pantalla de inicio
            </h4>
            {platform === 'ios' ? (
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Para recibir avisos de premios y sorteos en iOS: pulsa{' '}
                <span className="inline-flex items-center gap-0.5 font-semibold text-gray-800">
                  <Share className="inline h-3 w-3" /> Compartir
                </span>{' '}
                y luego{' '}
                <span className="inline-flex items-center gap-0.5 font-semibold text-gray-800">
                  <PlusSquare className="inline h-3 w-3" /> Añadir a pantalla de inicio
                </span>
                .
              </p>
            ) : (
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Accede rápidamente, consulta tus participaciones sin conexión y recibe avisos de premios al instante.
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-200/50 hover:text-gray-600"
          title="Cerrar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {platform !== 'ios' && deferredPrompt && (
        <div className="mt-2.5 flex justify-end">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 rounded-xl bg-lottery px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-lottery/20 transition hover:bg-lottery-600 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Instalar App</span>
          </button>
        </div>
      )}
    </aside>
  )
}
