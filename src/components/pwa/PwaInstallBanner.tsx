import React, { useState } from 'react'
import {
  usePwaInstallPrompt,
  type PwaPlatform,
} from '../../hooks/usePwaInstallPrompt'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import {
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  X,
  Smartphone,
  Monitor,
  Sparkles,
  Zap,
  Bell,
  WifiOff,
  Loader2,
} from 'lucide-react'

export interface PwaInstallBannerProps {
  isOpen?: boolean
  platform?: PwaPlatform
  hasNativePrompt?: boolean
  onInstall?: () => Promise<boolean> | void
  onDismiss?: (permanent?: boolean) => void
  onNeverShowAgain?: () => void
  isBlocked?: boolean
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({
  isOpen: propIsOpen,
  platform: propPlatform,
  hasNativePrompt: propHasNativePrompt,
  onInstall: propOnInstall,
  onDismiss: propOnDismiss,
  onNeverShowAgain: propOnNeverShowAgain,
  isBlocked,
}) => {
  // Hook interno de fallback si no se pasan props desde AppShell
  const hookPrompt = usePwaInstallPrompt({ isBlocked })

  const isOpen = propIsOpen !== undefined ? propIsOpen : hookPrompt.isOpen
  const platform = propPlatform !== undefined ? propPlatform : hookPrompt.platform
  const hasNativePrompt =
    propHasNativePrompt !== undefined ? propHasNativePrompt : hookPrompt.hasNativePrompt
  const onDismiss = propOnDismiss || hookPrompt.dismiss
  const onNeverShowAgain = propOnNeverShowAgain || hookPrompt.neverShowAgain
  const onInstall = propOnInstall || hookPrompt.install

  const [isInstalling, setIsInstalling] = useState(false)

  // Integración con botón Atrás de Android
  useModalBackHandler({
    isOpen,
    onClose: onDismiss,
    modalKey: 'pwa_install_banner',
  })

  if (!isOpen) return null

  const handleInstallClick = async () => {
    try {
      setIsInstalling(true)
      await onInstall()
    } finally {
      setIsInstalling(false)
    }
  }

  const handleUnderstood = () => {
    onNeverShowAgain()
  }

  const handleNeverShowAgain = () => {
    onNeverShowAgain()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5 animate-in slide-in-from-bottom-6 duration-200">
        {/* Pestaña táctil móvil */}
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Cabecera con icono corporativo y botón cerrar */}
        <div className="p-5 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lottery text-white shadow-md shadow-lottery/20 ring-4 ring-lottery/10">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-lottery tracking-wider uppercase bg-lottery-50 px-2 py-0.5 rounded-full mb-0.5">
                <Sparkles className="h-2.5 w-2.5 text-lottery" />
                <span>Instalación PWA</span>
              </div>
              <h3 id="pwa-install-title" className="text-base font-bold text-gray-900 leading-tight">
                Instala MisDecimos en tu dispositivo
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNeverShowAgain}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Subtítulo explicativo */}
        <div className="px-5 pb-2">
          <p className="text-xs text-gray-600 leading-relaxed">
            Acceso rápido desde tu pantalla de inicio, modo pantalla completa sin barras del navegador y avisos de premios al instante.
          </p>
        </div>

        {/* Contenido adaptable según la plataforma */}
        <div className="px-5 py-3 overflow-y-auto overscroll-contain space-y-3.5">
          {/* 1. Android / Navegadores basados en Chromium */}
          {platform === 'chromium' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <Zap className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-gray-900">Acceso veloz</p>
                    <p className="text-[10px] text-gray-500">Un toque desde tu inicio</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <WifiOff className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-gray-900">Sin conexión</p>
                    <p className="text-[10px] text-gray-500">Consulta tus décimos</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <Bell className="h-4 w-4 text-lottery shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-gray-900">Avisos Push</p>
                    <p className="text-[10px] text-gray-500">Premios en directo</p>
                  </div>
                </div>
              </div>

              {!hasNativePrompt && (
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-900 text-xs">
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Instalación manual desde el navegador:</span>
                  </p>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Pulsa el menú de opciones (tres puntos <span className="font-bold">⋮</span>) de tu navegador y selecciona <span className="font-bold">«Instalar aplicación»</span> o <span className="font-bold">«Añadir a pantalla de inicio»</span>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 2. iOS / iPadOS */}
          {platform === 'ios' && (
            <div className="space-y-2.5">
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-sky-50/80 border border-sky-200/80 text-sky-950">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white font-bold text-xs">
                    1
                  </div>
                  <div className="text-xs leading-snug">
                    Pulsa el icono <span className="font-bold inline-flex items-center gap-0.5"><Share className="inline h-3.5 w-3.5 text-sky-700" /> Compartir</span> en la barra de Safari (abajo en iPhone o arriba en iPad).
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-950">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
                    2
                  </div>
                  <div className="text-xs leading-snug">
                    Desliza hacia abajo en el menú y selecciona <span className="font-bold inline-flex items-center gap-0.5"><PlusSquare className="inline h-3.5 w-3.5 text-emerald-700" /> «Añadir a pantalla de inicio»</span>.
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-white font-bold text-xs">
                    3
                  </div>
                  <div className="text-xs leading-snug">
                    Pulsa <span className="font-bold">«Añadir»</span> en la esquina superior derecha para confirmar la instalación.
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <span className="font-bold">Aviso importante de Apple:</span> Es imprescindible instalar la aplicación en tu pantalla de inicio para recibir notificaciones push en segundo plano.
              </div>
            </div>
          )}

          {/* 3. macOS Safari */}
          {platform === 'macos-safari' && (
            <div className="space-y-2.5">
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white font-bold text-xs mt-0.5">
                    1
                  </div>
                  <div className="text-xs leading-relaxed">
                    En la barra de menús superior de Safari, pulsa <span className="font-bold">Archivo → Añadir al Dock...</span> (o pulsa el botón <span className="font-bold">Compartir → Añadir al Dock</span>).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs mt-0.5">
                    2
                  </div>
                  <div className="text-xs leading-relaxed">
                    Confirma el nombre <span className="font-bold">MisDecimos</span> y pulsa <span className="font-bold">Añadir</span>.
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                Podrás abrir MisDecimos directamente desde el Dock como una app nativa con su propia ventana independiente.
              </p>
            </div>
          )}

          {/* 4. Otros navegadores de escritorio (desktop-other) */}
          {platform === 'desktop-other' && (
            <div className="space-y-2.5">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-xs space-y-2">
                <p className="font-semibold flex items-center gap-1.5">
                  <Monitor className="h-4 w-4 text-lottery" />
                  <span>Instalación en ordenador:</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-600">
                  <li>Pulsa el icono de instalación en la barra de direcciones de tu navegador.</li>
                  <li>O abre el menú de opciones (<span className="font-bold">≡</span> / <span className="font-bold">⋮</span>) y selecciona <span className="font-bold">«Instalar MisDecimos»</span> o <span className="font-bold">«Crear acceso directo»</span>.</li>
                </ol>
              </div>

              <p className="text-[10px] text-gray-400">
                Para la mejor experiencia de instalación en 1 clic en ordenador, te recomendamos usar Google Chrome o Microsoft Edge.
              </p>
            </div>
          )}
        </div>

        {/* Botones de acción inferiores */}
        <div className="p-5 pt-3 border-t border-gray-100 flex flex-col gap-2">
          {hasNativePrompt ? (
            <>
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-lottery hover:bg-lottery-600 text-white text-xs font-bold shadow-md shadow-lottery/20 transition active:scale-[0.98] disabled:opacity-50"
              >
                {isInstalling ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Download className="h-4 w-4 text-white" />
                )}
                <span>Instalar aplicación</span>
              </button>

              <button
                type="button"
                onClick={handleNeverShowAgain}
                className="w-full text-center py-2 text-xs font-semibold text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                Ahora no
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleUnderstood}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-lottery hover:bg-lottery-600 text-white text-xs font-bold shadow-sm shadow-lottery/20 transition active:scale-[0.98] cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4 text-white" />
              <span>Entendido</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
