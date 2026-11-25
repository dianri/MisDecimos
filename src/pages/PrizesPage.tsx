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
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
            Resumen de Premios
          </h2>
          <p className="text-[11px] text-gray-500">
            Balance de tus décimos activos y resultados oficiales comprobados
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#F7F9F7] p-3.5 border border-gray-200/50 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
              Décimos Activos
            </span>
            <p className="text-2xl font-extrabold font-mono text-lottery">
              {summary.activeTicketsCount}
            </p>
          </div>

          <div className="rounded-2xl bg-[#F7F9F7] p-3.5 border border-gray-200/50 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
              Total Premios
            </span>
            <p className="text-2xl font-extrabold font-mono text-gold-600">
              {currencyFormatter.format(summary.totalPrizeEuros)} €
            </p>
          </div>
        </div>
      </div>

      {/* 2. Bloque Inferior — Historial de Escrutinio */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Historial de Escrutinio
          </h3>

          {/* Filtro rápido con contadores */}
          <div className="inline-flex rounded-xl bg-gray-100 p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setFilter('todos')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filter === 'todos'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Todos ({summary.scrutinizedItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('premiados')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filter === 'premiados'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Premiados ({summary.prizedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('sin_premio')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filter === 'sin_premio'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sin premio ({summary.noPrizeCount})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-lottery" />
          </div>
        ) : summary.scrutinizedItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-8 text-center space-y-2.5">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Sin sorteos comprobados aún</h3>
            <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
              Aquí aparecerán tus décimos premiados y el historial de sorteos comprobados en cuanto valides tus décimos.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-7 text-center space-y-1.5">
            <p className="text-xs font-bold text-gray-700">
              {filter === 'premiados'
                ? 'Ningún décimo premiado en este filtro'
                : 'No hay décimos comprobados sin premio'}
            </p>
            <p className="text-[11px] text-gray-400">
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
                  className={`w-full text-left rounded-2xl p-4 transition-all active:scale-[0.99] relative overflow-hidden space-y-2.5 cursor-pointer ${
                    isPrized
                      ? 'bg-gradient-to-br from-amber-50/90 via-white to-emerald-50/80 border-2 border-amber-400/85 shadow-md shadow-amber-900/5 hover:border-amber-500'
                      : 'bg-white border border-gray-100 shadow-sm hover:border-lottery/30 hover:shadow-md'
                  }`}
                >
                  {isPrized && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-500" />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                          isPrized
                            ? 'bg-amber-100 text-amber-600 border border-amber-300/80'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
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
                          <span className="text-base font-extrabold font-mono tracking-wider text-gray-900">
                            {ticket.number}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isOwner
                                ? 'bg-lottery-50 text-lottery border-lottery-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {isOwner ? 'Propio' : `Participación · ${userPercentage}%`}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          {ticket.draw_name}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isPrized ? (
                        <div>
                          <p className="text-base font-black font-mono text-emerald-700 leading-tight">
                            {userPrizeFormatted}
                          </p>
                          <span className="text-[10px] font-bold text-emerald-700/80">
                            tu {userPercentage}%
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm font-extrabold font-mono text-gray-600">0,00 €</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100/80 text-[11px]">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{ticket.draw_date}</span>
                    </div>

                    {isPrized ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100/90 text-amber-900 border border-amber-300/80 text-[10px] font-bold">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>{prizeCategory || 'Décimo premiado'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10px] font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Comprobado · Sin premio</span>
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
