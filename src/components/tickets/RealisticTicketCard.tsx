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
  const isPrized = (ticket.prize_amount_cents || 0) > 0

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
      className={`relative rounded-[22px] overflow-hidden border shadow-sm select-none transition-all ${
        isPrized
          ? 'bg-[#C5A880] border-[#C5A880] text-[#1D1D1F]'
          : 'bg-white dark:bg-[#1D1D1F] border-[#1D1D1F]/15 dark:border-[#F5F5F7]/15 text-[#1D1D1F] dark:text-[#F5F5F7]'
      } ${isCompact ? 'p-3' : 'p-4 sm:p-5'} ${className}`}
    >
      {/* Fondo con imagen de plantilla oficial si existe y carga sin errores */}
      {hasValidTemplateImage ? (
        <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-inner border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10">
          <img
            src={template!.template_image_url!}
            alt={ticket.draw_name}
            onError={() => setImageLoadError(true)}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
            <div className="flex justify-between items-start">
              <span className="bg-black/65 text-white font-mono text-[10px] px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                {ticket.draw_name}
              </span>
              <span className="bg-[#3A5245] text-white font-mono text-xs px-2.5 py-0.5 rounded-full font-semibold shadow-xs">
                {ticket.ticket_price} €
              </span>
            </div>
            <div className="bg-white/95 dark:bg-[#1D1D1F]/95 backdrop-blur-md rounded-xl p-3 border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 shadow-md flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
                  Número Registrado
                </p>
                <p className="text-3xl font-black tracking-tight tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {ticket.number}
                </p>
              </div>
              <div className="text-right text-xs tabular-nums space-y-0.5 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
                <p className="font-semibold">
                  Serie: <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">{ticket.serie || '001'}</span>
                </p>
                <p className="font-semibold">
                  Fracc.: <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">{ticket.fraccion || '01'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Diseño Minimalista Apple del Décimo */
        <div className="relative space-y-4">
          {/* Cabecera del Décimo */}
          <div
            className={`flex items-start justify-between pb-3 border-b ${
              isPrized
                ? 'border-[#1D1D1F]/15'
                : 'border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10'
            }`}
          >
            <div className="space-y-0.5">
              <h4
                className={`text-[11px] font-bold uppercase tracking-widest ${
                  isPrized
                    ? 'text-[#1D1D1F]'
                    : 'text-[#3A5245] dark:text-[#C5A880]'
                }`}
              >
                LOTERÍA NACIONAL DE ESPAÑA
              </h4>
              <p
                className={`text-xs font-bold ${
                  isPrized ? 'text-[#1D1D1F]' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
                }`}
              >
                {ticket.draw_name}
              </p>
              <p
                className={`text-[10px] font-medium ${
                  isPrized
                    ? 'text-[#1D1D1F]/75'
                    : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'
                }`}
              >
                Sorteo del {formattedDate}
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#3A5245] text-[#FFFFFF] text-xs font-semibold tabular-nums">
                {ticket.ticket_price} €
              </span>
              <p
                className={`text-[9px] uppercase tracking-wider font-semibold mt-1 ${
                  isPrized
                    ? 'text-[#1D1D1F]/75'
                    : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'
                }`}
              >
                DÉCIMO
              </p>
            </div>
          </div>

          {/* Cuerpo Central: Sello Digital + Número de 5 Cifras */}
          <div className="grid grid-cols-12 gap-3 items-center py-0.5">
            {/* Recuadro de Sello Digital */}
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
              className={`col-span-4 rounded-2xl border p-2.5 flex flex-col items-center justify-center text-center ${
                isPrized
                  ? 'bg-[#1D1D1F]/10 border-[#1D1D1F]/20'
                  : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10'
              } ${onSealClick ? 'cursor-pointer select-none active:scale-95 transition' : ''}`}
            >
              <div
                className={`h-8 w-8 rounded-full border flex items-center justify-center mb-1.5 ${
                  isPrized
                    ? 'bg-[#3A5245] border-[#3A5245] text-[#C5A880]'
                    : 'bg-white dark:bg-[#1D1D1F] border-[#C5A880]/50 text-[#C5A880]'
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p
                className={`text-[9px] font-extrabold uppercase tracking-wider leading-tight ${
                  isPrized ? 'text-[#1D1D1F]' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
                }`}
              >
                MisDecimos
              </p>
              <p
                className={`text-[8px] font-mono leading-none mt-0.5 ${
                  isPrized
                    ? 'text-[#1D1D1F]/75'
                    : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'
                }`}
              >
                SELLO DIGITAL
              </p>
            </div>

            {/* Número Principal */}
            <div
              className={`col-span-8 flex flex-col justify-center items-center rounded-2xl border p-3 ${
                isPrized
                  ? 'bg-[#1D1D1F]/10 border-[#1D1D1F]/15'
                  : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10'
              }`}
            >
              <span
                className={`text-[10px] font-semibold tracking-widest uppercase mb-0.5 ${
                  isPrized
                    ? 'text-[#1D1D1F]/75'
                    : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'
                }`}
              >
                NÚMERO
              </span>
              <div
                className={`text-3xl sm:text-4xl font-black tracking-tight tabular-nums ${
                  isPrized ? 'text-[#1D1D1F]' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
                }`}
              >
                {ticket.number}
              </div>
              <div
                className={`flex items-center gap-3 mt-2 text-xs tabular-nums ${
                  isPrized
                    ? 'text-[#1D1D1F]/75'
                    : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'
                }`}
              >
                <span>
                  SERIE:{' '}
                  <strong className={isPrized ? 'text-[#1D1D1F]' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'}>
                    {ticket.serie || '001'}
                  </strong>
                </span>
                <span className="opacity-40">|</span>
                <span>
                  FRACCIÓN:{' '}
                  <strong className={isPrized ? 'text-[#1D1D1F]' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'}>
                    {ticket.fraccion || '01'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Pie: Código de Barras GS1-128 */}
          {!isCompact && (
            <div
              className={`pt-3 border-t border-dashed flex flex-col items-center justify-center gap-1.5 ${
                isPrized
                  ? 'border-[#1D1D1F]/20'
                  : 'border-[#1D1D1F]/15 dark:border-[#F5F5F7]/15'
              }`}
            >
              <div
                className="h-7 w-56 flex items-center justify-between opacity-85"
                title={ticket.barcode_raw || 'Código GS1-128 Oficial'}
              >
                {[
                  3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 4, 2, 1, 2, 3, 4, 1, 2, 1, 3, 2, 4, 1,
                  2, 3, 1, 4,
                ].map((w, idx) => (
                  <span
                    key={idx}
                    className={`h-full inline-block ${
                      isPrized ? 'bg-[#1D1D1F]' : 'bg-[#1D1D1F] dark:bg-[#F5F5F7]'
                    }`}
                    style={{ width: `${w * 1.5}px` }}
                  />
                ))}
              </div>
              <p
                className={`font-mono text-[9px] tracking-wider ${
                  isPrized
                    ? 'text-[#1D1D1F]/75'
                    : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'
                }`}
              >
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
