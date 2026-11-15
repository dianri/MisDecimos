import React from 'react'
import type { Database } from '../../types/database.types'
import { Ticket, Archive, Calendar, Users } from 'lucide-react'

type TicketRow = Database['public']['Tables']['tickets']['Row']

export interface TicketListItemCardProps {
  ticket: TicketRow
  userPercentage: number
  participantsCount: number
  isArchived?: boolean
  onClick: (ticketId: string) => void
}

export const TicketListItemCard: React.FC<TicketListItemCardProps> = ({
  ticket,
  userPercentage,
  participantsCount,
  isArchived = false,
  onClick,
}) => {
  // Estado del premio
  const prizeStatusDisplay = (() => {
    if (ticket.status === 'PENDIENTE') {
      return <span className="text-gray-400 font-medium">Sorteo pendiente</span>
    }
    if (ticket.prize_amount_cents > 0) {
      const euros = (ticket.prize_amount_cents / 100).toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      const userPrize = ((ticket.prize_amount_cents * userPercentage) / 10000).toLocaleString(
        'es-ES',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )
      return (
        <span className="text-emerald-700 font-bold">
          Premio: {euros} € ({userPrize} € tuyos)
        </span>
      )
    }
    return <span className="text-rose-600 font-medium">No premiado</span>
  })()

  // Badge de estado
  const statusBadge = (() => {
    switch (ticket.status) {
      case 'VALIDADO':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'LIQUIDADO':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300'
      case 'ARCHIVADO':
        return 'bg-gray-100 text-gray-600 border-gray-200'
      case 'PENDIENTE':
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200'
    }
  })()

  return (
    <div
      onClick={() => onClick(ticket.id)}
      className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 hover:shadow-md hover:border-lottery/30 active:scale-[0.99] transition-all cursor-pointer space-y-3"
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
              isArchived ? 'bg-gray-100 text-gray-500' : 'bg-lottery-50 text-lottery'
            }`}
          >
            {isArchived ? <Archive className="w-4 h-4" /> : <Ticket className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-900 leading-tight">
              Décimo #{ticket.number}
            </h3>
            <p className="text-[11px] text-gray-500 truncate max-w-[180px] sm:max-w-xs">
              {ticket.draw_name}
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border uppercase tracking-wider ${statusBadge}`}
        >
          {ticket.status}
        </span>
      </div>

      {/* Recuadro Central con Número en Ámbar */}
      <div className="bg-gray-50/90 rounded-2xl p-3 border border-gray-200/60 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
            NÚMERO REGISTRADO
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold font-mono tracking-widest text-gold-600">
            {ticket.number}
          </p>
        </div>

        <div className="text-right text-xs font-mono space-y-0.5">
          <p className="text-gray-600">
            SERIE: <strong className="text-gray-900">{ticket.serie || '001'}</strong>
          </p>
          <p className="text-gray-600">
            FRACCIÓN: <strong className="text-gray-900">{ticket.fraccion || '01'}</strong>
          </p>
        </div>
      </div>

      {/* Pie de Tarjeta */}
      <div className="space-y-2 pt-1 border-t border-gray-100 text-xs">
        <div className="flex items-center justify-between text-gray-500 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Sorteo: {ticket.draw_date}</span>
          </div>
          <div>{prizeStatusDisplay}</div>
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

          <span className="px-2.5 py-0.5 rounded-full bg-lottery-50 border border-lottery-200 text-lottery text-xs font-bold font-mono">
            {userPercentage === 100 ? '100% tuyo' : `${userPercentage}% tuyo`}
          </span>
        </div>
      </div>
    </div>
  )
}
