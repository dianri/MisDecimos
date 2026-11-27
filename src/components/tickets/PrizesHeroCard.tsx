import React from 'react'
import { Banknote } from 'lucide-react'
import type { PrizesSummaryResult } from '../../lib/prizesSummary'

export interface PrizesHeroCardProps {
  summary: PrizesSummaryResult
}

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
})

/**
 * Tarjeta financiera principal (Apple Wallet / Cava Granite) con el resumen de
 * Ganado, balance neto (Ganado - Jugado), Jugado, Cobrado y barra de progreso.
 */
export const PrizesHeroCard: React.FC<PrizesHeroCardProps> = ({ summary }) => {
  const netCents = summary.totalPrizeCents - summary.totalPlayedCents
  const netSign = netCents > 0 ? '+' : netCents < 0 ? '-' : ''
  const netFormatted = `${netSign}${currencyFormatter.format(Math.abs(netCents) / 100)}\u00A0€`

  const collectedPercent =
    summary.totalPrizeCents > 0
      ? Math.min(100, Math.round((summary.totalCollectedCents / summary.totalPrizeCents) * 100))
      : 0

  return (
    <div className="bg-gradient-to-br from-[#FCF9F3] via-[#F7EFE0] to-[#EFE0C4] dark:from-[#262017] dark:via-[#1F1B15] dark:to-[#1D1D1F] border-[1.5px] border-[#C5A880] dark:border-[#C5A880]/75 rounded-[24px] p-5 shadow-[0_4px_16px_rgba(197,168,128,0.18)] space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3A5245] text-[#FFFFFF] shadow-xs shrink-0">
            <Banknote className="w-4 h-4 text-[#C5A880]" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70">
            Ganado
          </span>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-extrabold tabular-nums whitespace-nowrap shrink-0 ${
            netCents > 0
              ? 'bg-[#3A5245] text-[#FFFFFF]'
              : 'bg-[#1D1D1F]/[0.08] dark:bg-[#F5F5F7]/[0.10] text-[#1D1D1F]/75 dark:text-[#F5F5F7]/80'
          }`}
        >
          {netFormatted}
        </span>
      </div>

      <p className="text-4xl font-black tracking-tight tabular-nums leading-none text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap">
        {currencyFormatter.format(summary.totalPrizeEuros)}{'\u00A0'}€
      </p>

      <div className="space-y-2.5 pt-3 border-t border-[#C5A880]/30">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-medium text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65">
              Jugado
            </p>
            <p className="text-base font-extrabold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5 whitespace-nowrap">
              {currencyFormatter.format(summary.totalPlayedEuros)}{'\u00A0'}€
            </p>
          </div>

          <div className="text-right">
            <p className="text-[11px] font-medium text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65">
              Cobrado
            </p>
            <p className="text-base font-extrabold tabular-nums text-[#3A5245] dark:text-[#96BFA9] mt-0.5 whitespace-nowrap">
              {currencyFormatter.format(summary.totalCollectedEuros)}{'\u00A0'}€
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
  )
}
