import React from 'react'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import type { PushPromptContext } from '../../hooks/usePushPermissionPrompt'
import { BellRing, Bell, X, Loader2, Trophy, ShieldCheck } from 'lucide-react'

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
      <div className="w-full max-w-sm bg-white dark:bg-[#1D1D1F] rounded-[22px] p-5 shadow-2xl border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 flex flex-col gap-4 animate-in zoom-in-95 duration-200 relative">
        {/* Botón de cierre superior X */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[#1D1D1F]/50 dark:text-[#F5F5F7]/50 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icono Principal con Campana */}
        <div className="w-13 h-13 rounded-2xl bg-[#3A5245]/10 dark:bg-[#3A5245]/30 text-[#3A5245] dark:text-[#C5A880] flex items-center justify-center mx-auto shadow-xs border border-[#3A5245]/20 mt-1">
          <BellRing className="h-6 w-6" />
        </div>

        {/* Textos de Cabecera contextualizados */}
        <div className="text-center space-y-1.5">
          <h3 className="text-base font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            {isUnread ? 'Tienes notificaciones nuevas' : 'Activa las alertas push'}
          </h3>
          <p className="text-xs text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 leading-relaxed px-2">
            {isUnread
              ? 'Tienes avisos pendientes en tu buzón. Activa las notificaciones en este dispositivo para enterarte al instante sin tener que abrir la app.'
              : 'Recibe alertas instantáneas en tu móvil cuando te compartan un décimo, cuando se celebre el sorteo o si ganas un premio.'}
          </p>
        </div>

        {/* Beneficios clave */}
        <div className="bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 rounded-2xl p-3.5 space-y-2.5 text-xs text-[#1D1D1F] dark:text-[#F5F5F7]">
          <div className="flex items-center gap-2.5">
            <Bell className="h-4 w-4 text-[#3A5245] dark:text-[#C5A880] shrink-0" />
            <span className="leading-tight">Avisos inmediatos al recibir una participación</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Trophy className="h-4 w-4 text-[#C5A880] shrink-0" />
            <span className="leading-tight">Comprobación automática el día del sorteo</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[#3A5245] dark:text-[#C5A880] shrink-0" />
            <span className="leading-tight">Avisos de cobro y trazabilidad de custodia</span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onActivate}
            disabled={isActivating}
            className="w-full py-3 px-4 rounded-xl bg-[#C5A880] hover:bg-[#B8996E] text-[#1D1D1F] text-xs font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-98 transition disabled:opacity-45 cursor-pointer"
          >
            {isActivating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#1D1D1F]" />
                <span>Activando notificaciones...</span>
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 text-[#1D1D1F]" />
                <span>Activar notificaciones</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2 text-xs font-semibold text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition active:scale-98 cursor-pointer"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
