import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { X, Copy, Check, Share2, MessageCircle, Sparkles } from 'lucide-react'

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
  const [copied, setCopied] = useState(false)

  if (!isOpen || !invite) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://misdecimos.dianrie.com'
  const shareUrl = `${origin}/invite/${invite.invite_token}`

  const messageText = `🎟️ ¡Te he compartido una participación del ${invite.percentage}% para el décimo Nº ${
    invite.ticketNumber || ''
  } de ${invite.drawName || 'Lotería'} en MisDecimos!\n\n🔑 Código de 6 dígitos: ${
    invite.short_code
  }\n📲 Reclama tu cuota al instante aquí: ${shareUrl}`

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(invite.short_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
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
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(messageText)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleShareWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(messageText)}`
    window.open(whatsappUrl, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-3xl bg-white border border-gray-100 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90dvh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera (shrink-0) */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lottery text-white shadow-xs">
              <Share2 className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Compartir Participación</h3>
              <p className="text-[11px] text-gray-500">
                Cuota del {invite.percentage}% {invite.label ? `· ${invite.label}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo scrolleable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5 text-center">
          {/* Código de 6 Dígitos Prominente */}
          <div className="rounded-2xl border border-gold-300 bg-gold-50/50 p-4 space-y-1 relative">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-700">
              Código de Invitación (6 dígitos)
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-extrabold font-mono tracking-[0.25em] text-gray-900">
                {invite.short_code}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-2 rounded-xl bg-white border border-gold-200 text-gold-700 hover:bg-gold-50 active:scale-95 transition shadow-xs"
                title="Copiar código"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-[10px] font-semibold text-emerald-600 animate-in fade-in">
                ¡Código copiado al portapapeles!
              </p>
            )}
          </div>

          {/* Código QR Dinámico */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-3 bg-white rounded-2xl border-2 border-gray-100 shadow-sm inline-block">
              <QRCodeSVG
                value={shareUrl}
                size={180}
                level="M"
                includeMargin={false}
                imageSettings={{
                  src: '/favicon.svg',
                  x: undefined,
                  y: undefined,
                  height: 32,
                  width: 32,
                  excavate: true,
                }}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              El invitado puede escanear este código con su móvil
            </p>
          </div>

          <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-medium">
            <Sparkles className="h-3 w-3 text-gold-500" />
            <span>Trazabilidad asegurada · Cero porcentaje huérfano</span>
          </div>
        </div>

        {/* Botones de Compartir fijos abajo (shrink-0) */}
        <div className="shrink-0 border-t border-gray-100 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-2">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#25D366] text-white text-xs font-bold shadow-md shadow-emerald-500/20 hover:bg-[#20bd5a] active:scale-98 transition"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Enviar por WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleShareSystem}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 active:scale-98 transition shadow-xs"
          >
            <Share2 className="h-3.5 w-3.5 text-gray-500" />
            <span>Otras aplicaciones del sistema</span>
          </button>
        </div>
      </div>
    </div>
  )
}
