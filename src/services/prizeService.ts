import { supabase } from '../lib/supabase'
import { invokeEdgeFunction } from '../lib/invokeEdgeFunction'

export interface CheckPrizeResult {
  ok?: boolean
  success: boolean
  prizeAmountCents: number
  formattedPrize: string
  prizeCategory?: string
  checkSource: string
  listStatus: string
  checkedAt: string
  code?: string
  message?: string
  error?: string
  drawDate?: string
  simulated?: boolean
  reset?: boolean
}

export async function checkTicketPrize(params: {
  ticketId: string
  number: string
  drawType: string
  drawDate?: string
  ticketPrice?: number
  forceRefresh?: boolean
  simulatedPrizePerDecimo?: number
  resetSimulation?: boolean
}): Promise<CheckPrizeResult> {
  const data = await invokeEdgeFunction<CheckPrizeResult>('check-prizes', {
    body: params,
  })

  if (data?.error) {
    throw new Error(data.error)
  }

  if (data?.ok === false) {
    return {
      ok: false,
      success: false,
      code: data.code,
      message: data.message,
      drawDate: data.drawDate,
      prizeAmountCents: 0,
      formattedPrize: '0,00 €',
      checkSource: 'none',
      listStatus: 'sin_sorteo',
      checkedAt: new Date().toISOString(),
    }
  }

  return data as CheckPrizeResult
}

export async function simulateTicketPrize(
  ticketId: string,
  simulatedPrizePerDecimo: number
): Promise<CheckPrizeResult> {
  return checkTicketPrize({
    ticketId,
    number: '',
    drawType: '',
    simulatedPrizePerDecimo,
  })
}

export async function resetTicketPrizeSimulation(ticketId: string): Promise<CheckPrizeResult> {
  return checkTicketPrize({
    ticketId,
    number: '',
    drawType: '',
    resetSimulation: true,
  })
}

export interface RequestPrizePayoutResult {
  success: boolean
  share_id: string
  requested_at: string
  proportional_prize_cents: number
}

export interface ConfirmPrizePayoutResult {
  success: boolean
  share_id: string
  ticket_status: string
  fully_liquidated: boolean
}

export async function requestPrizePayoutConfirmation(
  shareId: string
): Promise<RequestPrizePayoutResult> {
  const { data, error } = await supabase.rpc('request_prize_payout_confirmation', {
    p_share_id: shareId,
  })

  if (error) {
    console.error('Error solicitando confirmación de cobro:', error)
    throw new Error(error.message || 'Error al solicitar confirmación de cobro.')
  }

  return data as unknown as RequestPrizePayoutResult
}

export async function confirmPrizePayoutReceived(
  shareId: string
): Promise<ConfirmPrizePayoutResult> {
  const { data, error } = await supabase.rpc('confirm_prize_payout_received', {
    p_share_id: shareId,
  })

  if (error) {
    console.error('Error confirmando cobro de premio:', error)
    throw new Error(error.message || 'Error al confirmar la recepción del premio.')
  }

  return data as unknown as ConfirmPrizePayoutResult
}
