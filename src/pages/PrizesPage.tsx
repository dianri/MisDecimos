import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  buildPrizesSummary,
  filterScrutinizedItems,
  type PrizesFilterType,
} from '../lib/prizesSummary'
import type { TicketRow, OwnershipShareRow } from '../lib/ticketMetrics'
import { Trophy, CheckCircle2, Calendar, Loader2, Sparkles } from 'lucide-react'

export interface PrizesPageProps {
  onSelectTicket?: (ticketId: string) => void
}

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
})

export const PrizesPage: React.FC<PrizesPageProps> = ({ onSelectTicket }) => {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [shares, setShares] = useState<OwnershipShareRow[]>([])
  const [archivedTicketIds, setArchivedTicketIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<PrizesFilterType>('todos')

  const loadData = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)

      const [{ data: ticketsData, error: ticketsErr }, { data: sharesData, error: sharesErr }, { data: hidesData }] =
        await Promise.all([
          supabase.from('tickets').select('*').order('draw_date', { ascending: false }),
          supabase.from('ownership_shares').select('*'),
          supabase
            .from('ticket_archive_hides')
            .select('ticket_id')
            .eq('user_id', user.id),
        ])

      if (ticketsErr) throw ticketsErr
      if (sharesErr) throw sharesErr

      setTickets(ticketsData || [])
      setShares(sharesData || [])
      setArchivedTicketIds(new Set((hidesData || []).map((h) => h.ticket_id)))
    } catch (err) {
      console.error('Error cargando resumen de premios:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel('prizes-page-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ownership_shares' },
        () => loadData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData])

  const summary = useMemo(
    () => buildPrizesSummary(tickets, shares, archivedTicketIds, user?.id || ''),
    [tickets, shares, archivedTicketIds, user?.id]
  )

  const filteredItems = useMemo(
    () => filterScrutinizedItems(summary.scrutinizedItems, filter),
    [summary.scrutinizedItems, filter]
  )

  return (
    <div className="space-y-5 pb-12 max-w-xl mx-auto">
      {/* 1. Bloque Superior — Tarjetas KPI (2 columnas) */}
      <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-black/[0.06] dark:border-white/[0.08] shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Resumen de Premios
          </h2>
          <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
            Balance de tus décimos activos y resultados oficiales comprobados
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#F5F5F7] dark:bg-[#000000] p-3.5 border border-black/[0.04] dark:border-white/[0.06] space-y-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
              Décimos Activos
            </span>
            <p className="text-2xl font-black tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
              {summary.activeTicketsCount}
            </p>
          </div>

          <div className="rounded-2xl bg-[#F5F5F7] dark:bg-[#000000] p-3.5 border border-black/[0.04] dark:border-white/[0.06] space-y-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
              Total Premios
            </span>
            <p className="text-2xl font-black tabular-nums text-[#C5A880]">
              {currencyFormatter.format(summary.totalPrizeEuros)} €
            </p>
          </div>
        </div>
      </div>

      {/* 2. Bloque Inferior — Historial de Escrutinio */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
            Historial de Escrutinio
          </h3>

          {/* Filtro rápido con contadores */}
          <div className="inline-flex rounded-xl bg-black/[0.05] dark:bg-white/[0.08] p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setFilter('todos')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                filter === 'todos'
                  ? 'bg-white dark:bg-[#1D1D1F] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs'
                  : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
              }`}
            >
              Todos ({summary.scrutinizedItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('premiados')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                filter === 'premiados'
                  ? 'bg-white dark:bg-[#1D1D1F] text-[#3A5245] dark:text-[#C5A880] shadow-xs'
                  : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
              }`}
            >
              Premiados ({summary.prizedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('sin_premio')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                filter === 'sin_premio'
                  ? 'bg-white dark:bg-[#1D1D1F] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs'
                  : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
              }`}
            >
              Sin premio ({summary.noPrizeCount})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#C5A880]" />
          </div>
        ) : summary.scrutinizedItems.length === 0 ? (
          <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-dashed border-black/10 dark:border-white/15 p-8 text-center space-y-2.5">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#C5A880]/15 flex items-center justify-center text-[#C5A880]">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Sin sorteos comprobados aún
            </h3>
            <p className="text-xs text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 max-w-xs mx-auto leading-relaxed">
              Aquí aparecerán tus décimos premiados y el historial de sorteos comprobados en cuanto valides tus décimos.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-dashed border-black/10 dark:border-white/15 p-7 text-center space-y-1.5">
            <p className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {filter === 'premiados'
                ? 'Ningún décimo premiado en este filtro'
                : 'No hay décimos comprobados sin premio'}
            </p>
            <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
              Cambia el filtro superior para ver el resto de resultados.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const { ticket, isOwner, userPercentage, isPrized, userPrizeCents, prizeCategory } =
                item
              const userPrizeFormatted = `${currencyFormatter.format(userPrizeCents / 100)} €`

              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => onSelectTicket?.(ticket.id)}
                  className={`w-full text-left rounded-[22px] p-5 transition-all active:scale-[0.99] relative overflow-hidden space-y-3 cursor-pointer ${
                    isPrized
                      ? 'bg-[#C5A880] text-[#1D1D1F] border border-[#C5A880] shadow-sm hover:brightness-[0.98]'
                      : 'bg-white dark:bg-[#1D1D1F] text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/[0.06] dark:border-white/[0.08] shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                          isPrized
                            ? 'bg-[#3A5245] text-[#FFFFFF]'
                            : 'bg-[#3A5245]/10 dark:bg-[#3A5245]/25 text-[#3A5245] dark:text-[#F5F5F7]'
                        }`}
                      >
                        {isPrized ? (
                          <Trophy className="w-4.5 h-4.5" />
                        ) : (
                          <CheckCircle2 className="w-4.5 h-4.5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-2xl font-black tracking-tight tabular-nums leading-none ${
                              isPrized ? 'text-[#1D1D1F]' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
                            }`}
                          >
                            {ticket.number}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isPrized
                                ? 'bg-[#1D1D1F]/10 text-[#1D1D1F]'
                                : 'bg-[#F5F5F7] dark:bg-white/10 text-[#1D1D1F]/75 dark:text-[#F5F5F7]/75'
                            }`}
                          >
                            {isOwner ? 'Propio' : `Participación · ${userPercentage}%`}
                          </span>
                        </div>
                        <p
                          className={`text-[11px] truncate mt-1 ${
                            isPrized
                              ? 'text-[#1D1D1F]/75'
                              : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'
                          }`}
                        >
                          {ticket.draw_name}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isPrized ? (
                        <div className="px-2.5 py-1 rounded-xl bg-[#3A5245] text-[#FFFFFF]">
                          <p className="text-sm font-black tabular-nums leading-tight">
                            {userPrizeFormatted}
                          </p>
                          <span className="text-[10px] font-medium text-[#FFFFFF]/80">
                            tu {userPercentage}%
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm font-bold tabular-nums text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
                          0,00 €
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className={`flex items-center justify-between gap-2 pt-2.5 border-t text-[11px] ${
                      isPrized
                        ? 'border-[#1D1D1F]/15'
                        : 'border-black/[0.06] dark:border-white/[0.08]'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1.5 ${
                        isPrized
                          ? 'text-[#1D1D1F]/75'
                          : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{ticket.draw_date}</span>
                    </div>

                    {isPrized ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#3A5245] text-[#FFFFFF] text-[10px] font-semibold">
                        <Sparkles className="w-3 h-3 text-[#C5A880]" />
                        <span>{prizeCategory || 'Décimo premiado'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#3A5245] text-[#FFFFFF] dark:text-[#F5F5F7] text-[10px] font-semibold">
                        <span>✓ Comprobado</span>
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
