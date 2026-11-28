import { supabase } from '../lib/supabase'
import { buildCanonicalLegalPayload, computeSha256Hex } from '../lib/legalCustody'

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
    throw new Error('La invitación no devolvió un décimo válido.')
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

  // Registrar evento PARTICIPATION_ACCEPTED en ticket_legal_events para trazabilidad completa
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      const [{ data: profileData }, { data: activeShare }, { data: ticketData }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('display_name, email')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('ownership_shares')
            .select('id, percentage')
            .eq('ticket_id', ticketId)
            .eq('user_id', user.id)
            .eq('status', 'ACEPTADA')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('tickets')
            .select('number, serie, fraccion, draw_name, draw_date, ticket_price')
            .eq('id', ticketId)
            .maybeSingle(),
        ])

      const pct = Number(activeShare?.percentage ?? result?.percentage ?? 0)
      const ticketPrice = Number(ticketData?.ticket_price ?? 20)
      const amount = (ticketPrice * pct) / 100
      const actorName =
        profileData?.display_name ||
        profileData?.email?.split('@')[0] ||
        user.email?.split('@')[0] ||
        'Partícipe'

      const payloadHash = await computeSha256Hex(
        buildCanonicalLegalPayload({
          eventType: 'PARTICIPATION_ACCEPTED',
          ticketId,
          ticketNumber: ticketData?.number || '',
          drawDate: ticketData?.draw_date || '',
          drawName: ticketData?.draw_name || '',
          serie: ticketData?.serie || null,
          fraccion: ticketData?.fraccion || null,
          ticketPrice,
          photoSha256: null,
          actorUserId: user.id,
          sharePercentage: pct,
          timestampIso: new Date().toISOString(),
        })
      )

      await supabase.from('ticket_legal_events').insert({
        ticket_id: ticketId,
        participation_id: activeShare?.id ?? null,
        actor_user_id: user.id,
        event_type: 'PARTICIPATION_ACCEPTED',
        actor_name: actorName,
        share_percentage: pct,
        share_amount: amount,
        payload_sha256: payloadHash,
      })
    }
  } catch (legalErr) {
    console.warn('No se pudo registrar PARTICIPATION_ACCEPTED en ticket_legal_events:', legalErr)
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
