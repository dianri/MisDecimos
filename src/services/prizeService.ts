import { supabase } from '../lib/supabase'

export interface CheckPrizeResult {
  success: boolean
  prizeAmountCents: number
  formattedPrize: string
  checkSource: string
  listStatus: string
  checkedAt: string
  error?: string
}

export async function checkTicketPrize(params: {
  ticketId: string
  number: string
  drawType: string
  ticketPrice?: number
  forceRefresh?: boolean
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

  return data as CheckPrizeResult
}
