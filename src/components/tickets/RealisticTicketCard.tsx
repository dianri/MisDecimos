import React, { useState, useEffect } from 'react'
import type { Database } from '../../types/database.types'
import { ShieldCheck } from 'lucide-react'

type TicketRow = Database['public']['Tables']['tickets']['Row']
type DrawTemplate = Database['public']['Tables']['draw_templates']['Row']

export interface RealisticTicketCardProps {
  ticket: TicketRow
  template?: DrawTemplate | null
  variant?: 'full' | 'compact'
  className?: string
  onSealClick?: () => void
}

export const RealisticTicketCard: React.FC<RealisticTicketCardProps> = ({
  ticket,
  template,
  variant = 'full',
  className = '',
  onSealClick,
}) => {
  const [imageLoadError, setImageLoadError] = useState(false)
  const isCompact = variant === 'compact'

  // Resetear el estado de error si cambia la URL de la plantilla
  useEffect(() => {
    setImageLoadError(false)
  }, [template?.template_image_url])

  const hasValidTemplateImage = Boolean(
    template?.template_image_url &&
    template.template_image_url.startsWith('http') &&
    !imageLoadError
  )

  const formattedDate = ticket.draw_date
    ? new Date(ticket.draw_date).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  return (
    <div
      className={`relative rounded-3xl overflow-hidden border border-amber-900/10 shadow-lg select-none transition-all ${
        isCompact ? 'p-3' : 'p-4 sm:p-5'
      } ${className}`}
      style={{
        background: 'linear-gradient(135deg, #FFFCF7 0%, #F5F1E8 100%)',
      }}
    >
      {/* Fondo con imagen de plantilla oficial si existe y carga sin errores */}
      {hasValidTemplateImage ? (
        <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-inner border border-gray-200">
          <img
            src={template!.template_image_url!}
            alt={ticket.draw_name}
            onError={() => setImageLoadError(true)}
            className="w-full h-full object-cover"
          />
          {/* Overlays posicionados según overlay_config */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
            <div className="flex justify-between items-start">
              <span className="bg-black/60 text-white font-mono text-[10px] px-2 py-0.5 rounded backdrop-blur-xs">
                {ticket.draw_name}
              </span>
              <span className="bg-lottery text-white font-mono text-xs px-2.5 py-0.5 rounded-full font-bold shadow-xs">
                {ticket.ticket_price} €
              </span>
            </div>
            <div className="bg-white/95 backdrop-blur-md rounded-xl p-3 border border-amber-800/20 shadow-md flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                  Número Registrado
                </p>
                <p className="text-3xl font-extrabold font-mono tracking-widest text-gold-700">
                  {ticket.number}
                </p>
              </div>
              <div className="text-right text-xs font-mono space-y-0.5">
                <p className="text-gray-700 font-semibold">
                  Serie: <span className="text-gray-900">{ticket.serie || '001'}</span>
                </p>
                <p className="text-gray-700 font-semibold">
                  Fracc.: <span className="text-gray-900">{ticket.fraccion || '01'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Diseño Vectorial Realista de Décimo de Lotería Nacional */
        <div className="relative border-2 border-lottery/40 rounded-2xl p-4 bg-white/95 shadow-inner space-y-3 overflow-hidden">
          {/* Filigrana Guilloche Decorativa de Fondo */}
          <div
            className="absolute inset-0 opacity-[0.035] pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(#2E6146 1.5px, transparent 1.5px), radial-gradient(#D97706 1.5px, transparent 1.5px)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 8px 8px',
            }}
          />

          {/* Cabecera del Décimo */}
          <div className="flex items-start justify-between border-b border-lottery/20 pb-2.5 relative z-10">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-lottery">
                <h4 className="text-[11px] font-extrabold uppercase tracking-widest font-sans">
                  LOTERÍA NACIONAL DE ESPAÑA
                </h4>
              </div>
              <p className="text-xs font-bold text-gray-900">{ticket.draw_name}</p>
              <p className="text-[10px] text-gray-500 font-medium">Sorteo del {formattedDate}</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-lottery-50 border border-lottery-200 text-lottery text-xs font-bold font-mono shadow-xs">
                {ticket.ticket_price} €
              </span>
              <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mt-0.5">
                DÉCIMO
              </p>
            </div>
          </div>

          {/* Cuerpo Central: Capilla Artística + Número de 5 Cifras */}
          <div className="grid grid-cols-12 gap-3 items-center relative z-10 py-1">
            {/* Recuadro de Capilla con Sello Digital */}
            <div
              onClick={onSealClick}
              role={onSealClick ? 'button' : undefined}
              tabIndex={onSealClick ? 0 : undefined}
              onKeyDown={
                onSealClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSealClick()
                      }
                    }
                  : undefined
              }
              aria-label={onSealClick ? 'MISDECIMOS SELLO DIGITAL' : undefined}
              title={onSealClick ? 'MISDECIMOS SELLO DIGITAL' : undefined}
              className={`col-span-4 rounded-xl border border-gold-300 bg-gradient-to-b from-amber-50/80 to-amber-100/50 p-2.5 flex flex-col items-center justify-center text-center shadow-xs ${
                onSealClick ? 'cursor-pointer select-none active:scale-95 transition' : ''
              }`}
            >
              <div className="h-8 w-8 rounded-full border border-gold-500/40 bg-white flex items-center justify-center text-gold-700 mb-1 shadow-xs">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-lottery leading-tight font-serif">
                MisDecimos
              </p>
              <p className="text-[8px] font-mono text-gray-500 leading-none mt-0.5">
                SELLO DIGITAL
              </p>
            </div>

            {/* Número Principal con Tipografía de Imprenta Nacional */}
            <div className="col-span-8 flex flex-col justify-center items-center rounded-xl bg-gray-50/80 border border-gray-200/80 p-3 shadow-inner">
              <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-0.5">
                NÚMERO
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-[0.25em] text-lottery-900 drop-shadow-xs">
                {ticket.number}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs font-mono text-gray-700">
                <span>
                  SERIE: <strong className="text-gray-900">{ticket.serie || '001'}</strong>
                </span>
                <span className="text-gray-300">|</span>
                <span>
                  FRACCIÓN: <strong className="text-gray-900">{ticket.fraccion || '01'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Pie: Código de Barras GS1-128 Simulado y Hash */}
          {!isCompact && (
            <div className="pt-2 border-t border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 relative z-10">
              {/* Código de barras en líneas SVG */}
              <div
                className="h-7 w-56 flex items-center justify-between opacity-80"
                title={ticket.barcode_raw || 'Código GS1-128 Oficial'}
              >
                {[
                  3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 4, 2, 1, 2, 3, 4, 1, 2, 1, 3, 2, 4, 1,
                  2, 3, 1, 4,
                ].map((w, idx) => (
                  <span
                    key={idx}
                    className="bg-gray-800 h-full inline-block"
                    style={{ width: `${w * 1.5}px` }}
                  />
                ))}
              </div>
              <p className="font-mono text-[9px] tracking-wider text-gray-400">
                {ticket.barcode_raw
                  ? `GS1: ${ticket.barcode_raw.slice(0, 24)}...`
                  : `01${ticket.number}${ticket.fraccion || '01'}${ticket.serie || '001'}2026`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
