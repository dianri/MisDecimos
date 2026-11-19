import { supabase } from '../lib/supabase'

export interface CheckPrizeResult {
  ok?: boolean
  success: boolean
  prizeAmountCents: number
  formattedPrize: string
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
  const { data, error } = await supabase.functions.invoke('check-prizes', {
    body: params,
  })

  if (error) {
    console.error('Error invocando Edge Function check-prizes:', error)
    throw new Error(error.message || 'Error al consultar resultados oficiales.')
  }

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
