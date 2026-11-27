import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { buildPrizesSummary } from '../lib/prizesSummary'
import type { TicketRow, OwnershipShareRow } from '../lib/ticketMetrics'
import { Banknote, Loader2 } from 'lucide-react'

export interface PrizesPageProps {
  onSelectTicket?: (ticketId: string) => void
}

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
})

export const PrizesPage: React.FC<PrizesPageProps> = () => {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [shares, setShares] = useState<OwnershipShareRow[]>([])
  const [archivedTicketIds, setArchivedTicketIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

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

  const summaryRows = [
    {
      label: 'Décimos totales',
      value: String(summary.activeTicketsCount),
      valueClass: 'text-[#1D1D1F] dark:text-[#F5F5F7]',
    },
    {
      label: 'Comprobados',
      value: `${summary.checkedCount} / ${summary.activeTicketsCount}`,
      valueClass: 'text-[#1D1D1F] dark:text-[#F5F5F7]',
    },
    {
      label: 'Compartidos',
      value: String(summary.sharedCount),
      valueClass: 'text-[#1D1D1F] dark:text-[#F5F5F7]',
    },
    {
      label: 'Jugado',
      value: `${currencyFormatter.format(summary.totalPlayedEuros)} €`,
      valueClass: 'text-[#1D1D1F] dark:text-[#F5F5F7]',
    },
    {
      label: 'Ganado',
      value: `${currencyFormatter.format(summary.totalPrizeEuros)} €`,
      valueClass:
        summary.totalPrizeCents > 0
          ? 'text-[#3A5245] dark:text-[#C5A880]'
          : 'text-[#1D1D1F] dark:text-[#F5F5F7]',
    },
    {
      label: 'Cobrado',
      value: `${currencyFormatter.format(summary.totalCollectedEuros)} €`,
      valueClass:
        summary.totalCollectedCents > 0
          ? 'text-[#3A5245] dark:text-[#96BFA9]'
          : 'text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70',
    },
  ]

  return (
    <div className="pb-12 max-w-xl mx-auto">
      <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1D1D1F]/[0.06] dark:border-[#F5F5F7]/[0.08] flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C5A880]/18 text-[#8C6D43] dark:bg-[#C5A880]/20 dark:text-[#E2CCA8]">
            <Banknote className="w-4 h-4" />
          </span>
          <h2 className="text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Resumen
          </h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#C5A880]" />
          </div>
        ) : (
          <div className="divide-y divide-[#1D1D1F]/[0.06] dark:divide-[#F5F5F7]/[0.08]">
            {summaryRows.map((row) => (
              <div
                key={row.label}
                className="px-5 py-3.5 flex items-center justify-between gap-4"
              >
                <span className="text-xs font-medium text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70">
                  {row.label}
                </span>
                <span className={`text-sm font-extrabold tabular-nums ${row.valueClass}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
