import React from 'react'
import type { Database } from '../../types/database.types'
import { Ticket, Archive, Calendar, Users, Trophy, Sparkles } from 'lucide-react'
import { resolveTicketCardPresentation } from '../../lib/ticketCardHelper'

type TicketRow = Database['public']['Tables']['tickets']['Row']

export interface TicketListItemCardProps {
  ticket: TicketRow
  userPercentage: number
  participantsCount: number
  isArchived?: boolean
  isRenounced?: boolean
  onClick: (ticketId: string) => void
}

export const TicketListItemCard: React.FC<TicketListItemCardProps> = ({
  ticket,
  userPercentage,
  participantsCount,
  isArchived = false,
  isRenounced = false,
  onClick,
}) => {
  const {
    isPrized,
    totalPrizeFormatted,
    userPrizeFormatted,
    isUserActive,
    statusBadgeLabel,
    statusBadgeClasses,
    containerClasses,
  } = resolveTicketCardPresentation({
    prizeAmountCents: ticket.prize_amount_cents || 0,
    status: ticket.status,
    userPercentage,
    isArchived,
    isRenounced,
  })

  return (
    <div
      onClick={() => onClick(ticket.id)}
      className={containerClasses}
    >
      {/* Barra superior de acento dorado/esmeralda si está premiado */}
      {isPrized && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-500" />
      )}

      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              isPrized
                ? 'bg-amber-100 text-amber-700 border border-amber-300/80'
                : isArchived
                ? 'bg-gray-100 text-gray-500'
                : 'bg-lottery-50 text-lottery'
            }`}
          >
            {isPrized ? (
              <Trophy className="w-5 h-5 text-amber-600" />
            ) : isArchived ? (
              <Archive className="w-4 h-4" />
            ) : (
              <Ticket className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-gray-900 leading-tight">
                Décimo #{ticket.number}
              </h3>
              {isArchived && isPrized && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                  Archivado
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 truncate max-w-[170px] sm:max-w-xs">
              {ticket.draw_name}
            </p>
          </div>
        </div>

        {/* Badge de estado (¡PREMIADO! / LIQUIDADO / VALIDADO / PENDIENTE) */}
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border uppercase tracking-wider flex items-center gap-1 ${statusBadgeClasses}`}
        >
          {isPrized && <Sparkles className="w-3 h-3 shrink-0" />}
          <span>{statusBadgeLabel}</span>
        </span>
      </div>

      {/* Recuadro Central con Número */}
      <div
        className={`rounded-2xl p-3 border flex items-center justify-between ${
          isPrized
            ? 'bg-amber-50/60 border-amber-200/80 shadow-xs'
            : 'bg-gray-50/90 border-gray-200/60'
        }`}
      >
        <div>
          <p
            className={`text-[9px] font-bold uppercase tracking-wider ${
              isPrized ? 'text-amber-800/80' : 'text-gray-400'
            }`}
          >
            NÚMERO REGISTRADO
          </p>
          <p
            className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-widest ${
              isPrized ? 'text-amber-900' : 'text-gold-600'
            }`}
          >
            {ticket.number}
          </p>
        </div>

        <div className="text-right text-xs font-mono space-y-0.5">
          <p className={isPrized ? 'text-amber-950/80' : 'text-gray-600'}>
            SERIE: <strong className="text-gray-900">{ticket.serie || '001'}</strong>
          </p>
          <p className={isPrized ? 'text-amber-950/80' : 'text-gray-600'}>
            FRACCIÓN: <strong className="text-gray-900">{ticket.fraccion || '01'}</strong>
          </p>
        </div>
      </div>

      {/* Caja destacada de Premio dentro de la tarjeta (si prize_amount_cents > 0) */}
      {isPrized && (
        <div className="bg-emerald-600/10 border border-emerald-500/25 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0 text-emerald-700 shadow-xs">
              <Trophy className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              {isUserActive ? (
                <>
                  <p className="text-base font-extrabold font-mono text-emerald-800 leading-tight">
                    {userPrizeFormatted}{' '}
                    <span className="text-xs font-bold font-sans text-emerald-700">tuyos</span>
                  </p>
                  <p className="text-[11px] font-medium text-emerald-700/80 truncate">
                    Décimo: {totalPrizeFormatted}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-gray-700 leading-tight">
                    Décimo premiado: <span className="font-mono text-emerald-800">{totalPrizeFormatted}</span>
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium">
                    Cuota: <span className="text-rose-700 font-semibold">Renunciada (0,00 €)</span>
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span
              className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide shadow-xs ${
                ticket.status === 'LIQUIDADO'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700 text-white'
              }`}
            >
              {ticket.status === 'LIQUIDADO' ? 'Cobrado' : 'Ganador'}
            </span>
          </div>
        </div>
      )}

      {/* Pie de Tarjeta */}
      <div className="space-y-2 pt-1 border-t border-gray-100 text-xs">
        <div className="flex items-center justify-between text-gray-500 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Sorteo: {ticket.draw_date}</span>
          </div>
          <div>
            {!isPrized ? (
              ticket.status === 'PENDIENTE' ? (
                <span className="text-gray-400 font-medium">Sorteo pendiente</span>
              ) : (
                <span className="text-rose-600 font-medium">No premiado</span>
              )
            ) : (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Boleto premiado</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span>
              {participantsCount === 1
                ? 'Solo tú'
                : `Compartido con ${participantsCount} personas`}
            </span>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full border text-xs font-bold font-mono ${
              isPrized
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-lottery-50 border-lottery-200 text-lottery'
            }`}
          >
            {userPercentage === 100 ? '100% tuyo' : `${userPercentage}% tuyo`}
          </span>
        </div>
      </div>
    </div>
  )
}
