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

  const netCents = summary.totalPrizeCents - summary.totalPlayedCents
  const netSign = netCents > 0 ? '+' : netCents < 0 ? '-' : ''
  const netFormatted = `${netSign}${currencyFormatter.format(Math.abs(netCents) / 100)} €`

  const collectedPercent =
    summary.totalPrizeCents > 0
      ? Math.min(100, Math.round((summary.totalCollectedCents / summary.totalPrizeCents) * 100))
      : 0

  const checkedPercent =
    summary.activeTicketsCount > 0
      ? Math.min(100, Math.round((summary.checkedCount / summary.activeTicketsCount) * 100))
      : 0

  if (isLoading) {
    return (
      <div className="flex justify-center p-12 max-w-xl mx-auto">
        <Loader2 className="h-6 w-6 animate-spin text-[#C5A880]" />
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-16 max-w-xl mx-auto">
      {/* 1. Hero Card Financiera (Apple Wallet / Cava Granite) */}
      <div className="bg-gradient-to-br from-[#FCF9F3] via-[#F7EFE0] to-[#EFE0C4] dark:from-[#262017] dark:via-[#1F1B15] dark:to-[#1D1D1F] border-[1.5px] border-[#C5A880] dark:border-[#C5A880]/75 rounded-[24px] p-5 shadow-[0_4px_16px_rgba(197,168,128,0.18)] space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3A5245] text-[#FFFFFF] shadow-xs">
              <Banknote className="w-4 h-4 text-[#C5A880]" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70">
              Ganado
            </span>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-extrabold tabular-nums ${
              netCents > 0
                ? 'bg-[#3A5245] text-[#FFFFFF]'
                : 'bg-[#1D1D1F]/[0.08] dark:bg-[#F5F5F7]/[0.10] text-[#1D1D1F]/75 dark:text-[#F5F5F7]/80'
            }`}
          >
            {netFormatted}
          </span>
        </div>

        <p className="text-4xl font-black tracking-tight tabular-nums leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          {currencyFormatter.format(summary.totalPrizeEuros)} €
        </p>

        <div className="space-y-2.5 pt-3 border-t border-[#C5A880]/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-medium text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65">
                Jugado
              </p>
              <p className="text-base font-extrabold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                {currencyFormatter.format(summary.totalPlayedEuros)} €
              </p>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-medium text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65">
                Cobrado
              </p>
              <p className="text-base font-extrabold tabular-nums text-[#3A5245] dark:text-[#96BFA9] mt-0.5">
                {currencyFormatter.format(summary.totalCollectedEuros)} €
              </p>
            </div>
          </div>

          <div
            aria-label="Progreso de cobro"
            className="h-1.5 w-full rounded-full bg-[#1D1D1F]/[0.08] dark:bg-[#F5F5F7]/[0.12] overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-[#3A5245] dark:bg-[#C5A880] transition-all duration-300"
              style={{ width: `${collectedPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Rejilla Bento de 3 Widgets (Contadores) */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white dark:bg-[#1D1D1F] rounded-[20px] border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08] p-3.5 shadow-xs flex flex-col justify-between gap-2">
          <span className="text-[11px] font-medium text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65 leading-tight">
            Décimos totales
          </span>
          <p className="text-2xl font-black tabular-nums leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
            {summary.activeTicketsCount}
          </p>
        </div>

        <div className="bg-white dark:bg-[#1D1D1F] rounded-[20px] border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08] p-3.5 shadow-xs flex flex-col justify-between gap-2">
          <span className="text-[11px] font-medium text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65 leading-tight">
            Comprobados
          </span>
          <div className="space-y-1.5">
            <p className="text-lg sm:text-xl font-black tabular-nums leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
              {summary.checkedCount} / {summary.activeTicketsCount}
            </p>
            <div
              aria-label="Progreso de escrutinio"
              className="h-1 w-full rounded-full bg-[#1D1D1F]/[0.08] dark:bg-[#F5F5F7]/[0.10] overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-[#3A5245] dark:bg-[#C5A880] transition-all duration-300"
                style={{ width: `${checkedPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1D1D1F] rounded-[20px] border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08] p-3.5 shadow-xs flex flex-col justify-between gap-2">
          <span className="text-[11px] font-medium text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65 leading-tight">
            Compartidos
          </span>
          <p className="text-2xl font-black tabular-nums leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
            {summary.sharedCount}
          </p>
        </div>
      </div>
    </div>
  )
}
