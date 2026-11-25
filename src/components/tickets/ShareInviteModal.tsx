import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import { X, Copy, Check, Share2, MessageCircle, ShieldCheck, ClipboardCheck } from 'lucide-react'
import { buildWhatsAppShareMessage, buildWhatsAppShareUrl } from '../../lib/shareHelper'

export interface ShareInviteModalProps {
  isOpen: boolean
  onClose: () => void
  invite: {
    id: string
    short_code: string
    invite_token: string
    percentage: number
    label?: string | null
    ticketNumber?: string
    drawName?: string
  } | null
}

export const ShareInviteModal: React.FC<ShareInviteModalProps> = ({
  isOpen,
  onClose,
  invite,
}) => {
  useModalBackHandler({ isOpen: isOpen && !!invite, onClose, modalKey: 'share_invite_modal' })

  const [copied, setCopied] = useState(false)
  const [whatsappCopiedNotice, setWhatsappCopiedNotice] = useState(false)

  if (!isOpen || !invite) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://misdecimos.dianrie.com'
  const shareUrl = `${origin}/invite/${invite.invite_token}`

  const messageText = buildWhatsAppShareMessage({
    percentage: invite.percentage,
    ticketNumber: invite.ticketNumber,
    drawName: invite.drawName,
    shortCode: invite.short_code,
    shareUrl,
  })

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(invite.short_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleShareWhatsApp = async () => {
    // 1. Copiar preventivamente el mensaje completo al portapapeles
    // para evitar que WhatsApp Desktop en macOS/Windows descarte el cuerpo del mensaje
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(messageText)
        setWhatsappCopiedNotice(true)
        setTimeout(() => setWhatsappCopiedNotice(false), 6000)
      }
    } catch {
      // Si el portapapeles no está disponible, continuar con la apertura
    }

    // 2. Abrir WhatsApp con codificación URI limpia
    const whatsappUrl = buildWhatsAppShareUrl(messageText)
    window.open(whatsappUrl, '_blank')
  }

  const handleShareSystem = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Participación de Lotería (${invite.percentage}%)`,
          text: messageText,
          url: shareUrl,
        })
        return
      } catch {
        // Fallback a WhatsApp
      }
    }
    await handleShareWhatsApp()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-[22px] bg-white dark:bg-[#1D1D1F] border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90dvh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera (shrink-0) */}
        <div className="flex items-center justify-between p-5 border-b border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 bg-[#F5F5F7]/60 dark:bg-[#2C2C2E]/60 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3A5245] text-white shadow-xs">
              <Share2 className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Compartir Participación
              </h3>
              <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
                Cuota del {invite.percentage}% {invite.label ? `· ${invite.label}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#1D1D1F]/50 dark:text-[#F5F5F7]/50 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo scrolleable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5 text-center">
          {/* Código de 6 Dígitos Prominente */}
          <div className="rounded-2xl border border-[#C5A880]/50 bg-[#C5A880]/15 p-4 space-y-1 relative">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70">
              Código de Invitación (6 dígitos)
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-black font-mono tracking-[0.25em] text-[#1D1D1F] dark:text-[#F5F5F7]">
                {invite.short_code}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-2 rounded-xl bg-white dark:bg-[#2C2C2E] border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 text-[#1D1D1F] dark:text-[#F5F5F7] hover:opacity-80 active:scale-95 transition shadow-xs cursor-pointer"
                title="Copiar código"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-[#3A5245] dark:text-[#C5A880]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-[10px] font-semibold text-[#3A5245] dark:text-[#C5A880] animate-in fade-in">
                ¡Código copiado al portapapeles!
              </p>
            )}
          </div>

          {/* Código QR Dinámico */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-3 bg-white rounded-2xl border border-[#1D1D1F]/10 shadow-sm inline-block">
              <QRCodeSVG
                value={shareUrl}
                size={180}
                level="M"
                includeMargin={false}
                imageSettings={{
                  src: '/logo-4mills.png',
                  x: undefined,
                  y: undefined,
                  height: 32,
                  width: 32,
                  excavate: true,
                }}
              />
            </div>
            <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
              El invitado puede escanear este código con su móvil
            </p>
          </div>

          <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-[#3A5245] dark:text-[#C5A880]" />
            <span>Trazabilidad asegurada · Cero porcentaje huérfano</span>
          </div>
        </div>

        {/* Botones de Compartir y feedback fijos abajo (shrink-0) */}
        <div className="shrink-0 border-t border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 bg-white dark:bg-[#1D1D1F] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-2">
          {/* Banner de feedback si se abrió WhatsApp y se copió al portapapeles */}
          {whatsappCopiedNotice && (
            <div className="rounded-xl bg-[#3A5245]/10 dark:bg-[#3A5245]/25 border border-[#3A5245]/30 p-2.5 text-left animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-start gap-2">
                <ClipboardCheck className="h-4 w-4 text-[#3A5245] dark:text-[#C5A880] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-[11px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Abriendo WhatsApp… Mensaje copiado
                  </p>
                  <p className="text-[10px] text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70 leading-snug">
                    Mensaje completo copiado al portapapeles. Si WhatsApp Escritorio solo pega el enlace, usa <strong>Pegar (Ctrl+V / ⌘V)</strong> para incluir los detalles y el código de 6 dígitos.
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#C5A880] hover:bg-[#B8996E] text-[#1D1D1F] text-xs font-semibold shadow-sm active:scale-98 transition cursor-pointer"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Enviar por WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleShareSystem}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold hover:opacity-85 active:scale-98 transition cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Otras aplicaciones del sistema</span>
          </button>
        </div>
      </div>
    </div>
  )
}
