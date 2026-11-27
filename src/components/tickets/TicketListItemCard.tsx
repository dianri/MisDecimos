import React from 'react'
import type { Database } from '../../types/database.types'
import { Banknote, Clover, Calendar, Share2, Search, Loader2 } from 'lucide-react'
import { formatDrawLabel, resolveTicketCardPresentation } from '../../lib/ticketCardHelper'

type TicketRow = Database['public']['Tables']['tickets']['Row']

export interface TicketListItemCardProps {
  ticket: TicketRow
  userPercentage: number
  isOwner?: boolean
  participantsCount?: number
  hasParticipations?: boolean
  isArchived?: boolean
  isRenounced?: boolean
  isCheckingPrize?: boolean
  onClick?: (ticketId: string) => void
  onShareClick?: (ticketId: string, hasParticipations: boolean) => void
  onCheckPrizeClick?: (ticket: TicketRow) => void
}

export const TicketListItemCard: React.FC<TicketListItemCardProps> = ({
  ticket,
  userPercentage,
  isOwner = true,
  hasParticipations,
  isArchived = false,
  isRenounced = false,
  isCheckingPrize = false,
  onClick,
  onShareClick,
  onCheckPrizeClick,
}) => {
  const {
    isPrized,
    isCheckedWithoutPrize,
    isShared,
    totalPrizeFormatted,
    userPrizeFormatted,
    isUserActive,
    containerClasses,
  } = resolveTicketCardPresentation({
    prizeAmountCents: ticket.prize_amount_cents || 0,
    status: ticket.status,
    userPercentage,
    isOwner,
    hasParticipations,
    isArchived,
    isRenounced,
    lastCheckedAt: ticket.last_checked_at,
  })

  const secondaryTextClass = isPrized
    ? 'text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70'
    : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'

  const primaryTextClass = 'text-[#1D1D1F] dark:text-[#F5F5F7]'

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement | null)?.closest('button, a, [data-no-card-nav="true"]')) {
          return
        }
        onClick?.(ticket.id)
      }}
      className={containerClasses}
    >
      {/* Número de 5 dígitos como rey visual + Serie/Fracción */}
      <div className="flex items-end justify-between gap-4 py-1">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${secondaryTextClass}`}>
            Número
          </p>
          <p
            className={`text-4xl sm:text-[42px] font-black tracking-tight tabular-nums leading-none ${primaryTextClass}`}
          >
            {ticket.number}
          </p>
        </div>

        <div className={`text-right text-xs tabular-nums space-y-0.5 ${secondaryTextClass}`}>
          <p>
            Serie{' '}
            <strong className={`font-semibold ${primaryTextClass}`}>
              {ticket.serie || '001'}
            </strong>
          </p>
          <p>
            Fracción{' '}
            <strong className={`font-semibold ${primaryTextClass}`}>
              {ticket.fraccion || '01'}
            </strong>
          </p>
        </div>
      </div>

      {/* Barra de resultado tras comprobar el sorteo */}
      {isPrized ? (
        <div className="bg-[#3A5245] text-[#FFFFFF] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Banknote className="w-5 h-5 shrink-0 text-[#C5A880]" />
            <div className="min-w-0">
              {isUserActive ? (
                <>
                  <p className="text-base font-black tabular-nums leading-tight text-[#FFFFFF]">
                    Has ganado {userPrizeFormatted}
                  </p>
                  {isShared && (
                    <p className="text-[11px] text-[#FFFFFF]/75 truncate">
                      De un total de {totalPrizeFormatted}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold leading-tight text-[#FFFFFF]">
                    Décimo premiado: <span className="tabular-nums">{totalPrizeFormatted}</span>
                  </p>
                  <p className="text-[11px] text-[#FFFFFF]/80">
                    Cuota renunciada (0,00 €)
                  </p>
                </>
              )}
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-white/15 text-[#FFFFFF] shrink-0">
            {ticket.status === 'LIQUIDADO' ? 'COBRADO' : 'PREMIADO'}
          </span>
        </div>
      ) : isCheckedWithoutPrize ? (
        <div className="bg-[#1D1D1F]/[0.05] dark:bg-[#F5F5F7]/[0.07] text-[#1D1D1F]/80 dark:text-[#F5F5F7]/85 border border-[#1D1D1F]/[0.08] dark:border-[#F5F5F7]/[0.10] rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
          <Clover className="w-4.5 h-4.5 shrink-0 text-[#C5A880]" />
          <span className="text-xs font-semibold">No premiado</span>
        </div>
      ) : null}

      {/* Pie de Tarjeta */}
      <div
        className={`space-y-2.5 pt-3 border-t text-xs ${
          isPrized
            ? 'border-[#C5A880]/35'
            : 'border-black/[0.06] dark:border-white/[0.08]'
        }`}
      >
        <div className={`flex items-center justify-between gap-2 text-[11px] ${secondaryTextClass}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{formatDrawLabel(ticket.draw_date)}</span>
          </div>

          {isOwner && (
            <button
              type="button"
              data-no-card-nav="true"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onShareClick?.(ticket.id, hasParticipations ?? false)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] bg-[#C5A880]/18 hover:bg-[#C5A880]/28 active:scale-[0.98] text-[#73562E] dark:bg-[#C5A880]/18 dark:hover:bg-[#C5A880]/28 dark:text-[#E5CFA9] border border-[#C5A880]/45 font-semibold transition-all shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartir</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            data-no-card-nav="true"
            disabled={isCheckingPrize}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onCheckPrizeClick?.(ticket)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] bg-[#3A5245]/12 hover:bg-[#3A5245]/20 active:scale-[0.98] text-[#2B3F34] dark:bg-[#3A5245]/30 dark:hover:bg-[#3A5245]/40 dark:text-[#A8CEB9] border border-[#3A5245]/25 font-semibold transition-all disabled:opacity-60 shrink-0 cursor-pointer"
          >
            {isCheckingPrize ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>{isCheckingPrize ? 'Comprobando...' : 'Comprobar sorteo'}</span>
          </button>

          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums bg-[#1D1D1F]/[0.05] dark:bg-[#F5F5F7]/[0.07] text-[#1D1D1F]/75 dark:text-[#F5F5F7]/75">
            {isOwner && userPercentage === 100
              ? '100% tuyo'
              : `Tu cuota: ${userPercentage}%`}
          </span>
        </div>
      </div>
    </div>
  )
}
