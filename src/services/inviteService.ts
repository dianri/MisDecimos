import { supabase } from '../lib/supabase'

export interface InvitePreviewResult {
  valid: boolean
  ticket_id: string
  number: string
  serie?: string | null
  fraccion?: string | null
  draw_name?: string | null
  draw_date?: string | null
  percentage: number
  label?: string | null
  owner_name: string
  short_code: string
}

export interface InviteClaimResult {
  success: boolean
  ticket_id: string
  percentage?: number
}

/**
 * Consulta la vista previa informativa de una invitación pendiente mediante su código de 6 dígitos o token.
 */
export async function previewInvite(codeOrToken: string): Promise<InvitePreviewResult> {
  const cleanCode = codeOrToken.trim()
  if (!cleanCode) {
    throw new Error('El código o token de invitación no puede estar vacío.')
  }

  const { data, error } = await supabase.rpc('accept_pending_invite', {
    p_code_or_token: cleanCode,
    p_confirm: false,
  })

  if (error) {
    throw error
  }

  const result = data as unknown as InvitePreviewResult
  if (!result?.ticket_id) {
    throw new Error('La invitación no devolvió un billete válido.')
  }

  return result
}

/**
 * Acepta y reclama de forma definitiva una participación en un décimo.
 * Garantiza que siempre devuelva de forma consistente el ticket_id y el porcentaje asignado.
 */
export async function claimInvite(codeOrToken: string): Promise<InviteClaimResult> {
  const cleanCode = codeOrToken.trim()
  if (!cleanCode) {
    throw new Error('El código o token de invitación no puede estar vacío.')
  }

  const { data, error } = await supabase.rpc('accept_pending_invite', {
    p_code_or_token: cleanCode,
    p_confirm: true,
  })

  if (error) {
    throw error
  }

  const result = data as { success?: boolean; ticket_id?: string; percentage?: number }
  const ticketId = result?.ticket_id

  if (!ticketId) {
    throw new Error('La confirmación de la participación no devolvió el identificador del décimo (ticket_id).')
  }

  return {
    success: Boolean(result?.success ?? true),
    ticket_id: ticketId,
    percentage: result?.percentage,
  }
}

/**
 * Rechaza una invitación pendiente, devolviendo el porcentaje íntegro al custodio.
 */
export async function rejectInvite(codeOrToken: string): Promise<boolean> {
  const cleanCode = codeOrToken.trim()
  if (!cleanCode) {
    throw new Error('El código o token de invitación no puede estar vacío.')
  }

  const { data, error } = await supabase.rpc('reject_pending_invite', {
    p_code_or_token: cleanCode,
  })

  if (error) {
    throw error
  }

  return Boolean(data)
}
