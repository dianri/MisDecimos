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

/**
 * Permite al propietario/custodio marcar o desmarcar su propia participación como cobrada.
 * Si el décimo no tiene participaciones de terceros, sincroniza también el estado LIQUIDADO/VALIDADO.
 */
export async function toggleOwnerPrizeCollected(params: {
  ticketId: string
  userId: string
  nextCollected: boolean
  hasThirdPartyParticipants?: boolean
}): Promise<void> {
  const nowIso = new Date().toISOString()

  const { error: shareErr } = await supabase
    .from('ownership_shares')
    .update({
      prize_paid_confirmed: params.nextCollected,
      prize_paid_confirmed_at: params.nextCollected ? nowIso : null,
      updated_at: nowIso,
    })
    .eq('ticket_id', params.ticketId)
    .eq('user_id', params.userId)

  if (shareErr) {
    console.error('Error actualizando estado de cobro del propietario:', shareErr)
    throw new Error(shareErr.message || 'No se pudo actualizar el estado de cobro.')
  }

  if (!params.hasThirdPartyParticipants) {
    const { error: ticketErr } = await supabase
      .from('tickets')
      .update({
        status: params.nextCollected ? 'LIQUIDADO' : 'VALIDADO',
        updated_at: nowIso,
      })
      .eq('id', params.ticketId)
      .eq('owner_id', params.userId)

    if (ticketErr) {
      console.error('Error sincronizando estado del décimo:', ticketErr)
      throw new Error(ticketErr.message || 'No se pudo sincronizar el estado del décimo.')
    }
  } else if (!params.nextCollected) {
    const { error: revertTicketErr } = await supabase
      .from('tickets')
      .update({
        status: 'VALIDADO',
        updated_at: nowIso,
      })
      .eq('id', params.ticketId)
      .eq('owner_id', params.userId)
      .eq('status', 'LIQUIDADO')

    if (revertTicketErr) {
      console.warn('Aviso al revertir estado LIQUIDADO del décimo:', revertTicketErr)
    }
  }
}
