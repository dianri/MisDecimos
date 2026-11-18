import React from 'react'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import type { PushPromptContext } from '../../hooks/usePushPermissionPrompt'
import { BellRing, Bell, X, Loader2, Sparkles, Trophy, ShieldCheck } from 'lucide-react'

interface PushPermissionModalProps {
  isOpen: boolean
  context: PushPromptContext
  isActivating: boolean
  onActivate: () => Promise<void>
  onDismiss: () => void
}

export const PushPermissionModal: React.FC<PushPermissionModalProps> = ({
  isOpen,
  context,
  isActivating,
  onActivate,
  onDismiss,
}) => {
  useModalBackHandler({
    isOpen,
    onClose: onDismiss,
    modalKey: 'push_permission_modal',
  })

  if (!isOpen) return null

  const isUnread = context === 'unread_alert'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200 relative">
        {/* Botón de cierre superior X */}
        <button
          type="button"
          onClick={onDismiss}
          disabled={isActivating}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icono Principal con Campana */}
        <div className="w-13 h-13 rounded-2xl bg-[#E6F0EB] text-[#2E6146] flex items-center justify-center mx-auto shadow-xs border border-[#2E6146]/20 mt-1">
          <BellRing className="h-6 w-6 animate-bounce" />
        </div>

        {/* Textos de Cabecera contextualizados */}
        <div className="text-center space-y-1.5">
          <h3 className="text-base font-extrabold text-gray-900 tracking-tight">
            {isUnread ? 'Tienes notificaciones nuevas' : '¡Activa las alertas push!'}
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed px-2">
            {isUnread
              ? 'Tienes avisos pendientes en tu buzón. Activa las notificaciones en este dispositivo para enterarte al instante sin tener que abrir la app.'
              : 'Recibe alertas instantáneas en tu móvil cuando te compartan un décimo, cuando se celebre el sorteo o si ganas un premio.'}
          </p>
        </div>

        {/* Beneficios clave */}
        <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3.5 space-y-2 text-xs text-gray-700">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-[#2E6146] shrink-0" />
            <span className="leading-tight">Avisos inmediatos al recibir una participación</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Trophy className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="leading-tight">Comprobación automática el día del sorteo</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="leading-tight">Avisos de cobro y trazabilidad de custodia</span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onActivate}
            disabled={isActivating}
            className="w-full py-3 px-4 rounded-xl bg-[#2E6146] hover:bg-[#244d37] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:scale-98 transition disabled:opacity-75 cursor-pointer"
          >
            {isActivating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Activando notificaciones...</span>
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 text-white" />
                <span>Activar notificaciones</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onDismiss}
            disabled={isActivating}
            className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition active:scale-98 cursor-pointer"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
