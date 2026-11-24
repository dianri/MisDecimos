import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { evaluateHistoricalDraw } from "./historicalDraws.ts"

// Encabezados CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CacheEntry {
  prizeAmountCents: number
  checkSource: string
  listStatus: string
  expiresAt: number
}

// Caché en memoria de la Edge Function
const cache = new Map<string, CacheEntry>()

function formatDrawDateShort(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || ''
  const [y, m, d] = dateStr.split('-')
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
}

function getDrawStartTimestamp(drawDate: string, drawType?: string): Date {
  const isElNino = drawType === 'EL_NINO' || drawDate.includes('-01-06')
  const hour = isElNino ? 12 : drawType === 'NAVIDAD' || drawDate.includes('-12-22') ? 9 : 13
  const hourStr = String(hour).padStart(2, '0')
  return new Date(`${drawDate}T${hourStr}:00:00+01:00`)
}

Deno.serve(async (req: Request) => {
  // Manejo de preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Falta cabecera Authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const {
      ticketId,
      number,
      drawType,
      drawDate,
      forceRefresh,
      simulatedPrizePerDecimo,
      resetSimulation,
    } = await req.json()

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: 'ticketId es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Validar usuario autenticado
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado o sesión expirada' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Obtener la verdad canónica del décimo en PostgreSQL
    const { data: ticketRow, error: ticketFetchErr } = await supabase
      .from('tickets')
      .select('id, number, draw_date, draw_type, status, owner_id')
      .eq('id', ticketId)
      .single()

    if (ticketFetchErr || !ticketRow) {
      return new Response(
        JSON.stringify({ error: 'Décimo no encontrado en la base de datos' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const effectiveDrawDate = ticketRow.draw_date || drawDate || new Date().toISOString().split('T')[0]
    const effectiveDrawType = ticketRow.draw_type || drawType || 'NAVIDAD'
    const ticketNumber = ticketRow.number || number
    const cleanNumber = String(ticketNumber || '00000').trim().padStart(5, '0')
    const cacheKey = `${effectiveDrawDate}:${effectiveDrawType}:${cleanNumber}`

    // -------------------------------------------------------------------------
    // NIVEL 1 — Simulación controlada (prioridad máxima)
    // -------------------------------------------------------------------------
    if (resetSimulation === true) {
      if (ticketRow.owner_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Solo el propietario del décimo puede restablecer la simulación' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: resetData, error: resetErr } = await supabase.rpc(
        'reset_ticket_prize_simulation',
        { p_ticket_id: ticketId }
      )

      if (resetErr) {
        console.error('[check-prizes] Error en reset_ticket_prize_simulation:', resetErr)
        return new Response(
          JSON.stringify({ error: resetErr.message || 'Error al restablecer simulación en base de datos' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      cache.delete(cacheKey)

      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          simulated: true,
          reset: true,
          prizeAmountCents: 0,
          formattedPrize: '0,00 €',
          message: 'Simulación de premio restablecida correctamente',
          drawDate: effectiveDrawDate,
          recordData: resetData,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (typeof simulatedPrizePerDecimo === 'number' && simulatedPrizePerDecimo > 0) {
      if (ticketRow.owner_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Solo el propietario del décimo puede simular premios' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const prizeAmountCents = Math.round(simulatedPrizePerDecimo * 100)

      const { data: recordData, error: rpcError } = await supabase.rpc(
        'record_ticket_prize_check',
        {
          p_ticket_id: ticketId,
          p_prize_amount_cents: prizeAmountCents,
          p_check_source: 'simulacion',
          p_list_status: 'final',
        }
      )

      if (rpcError) {
        console.error('[check-prizes] Error registrando premio simulado en RPC:', rpcError)
        return new Response(
          JSON.stringify({ error: rpcError.message || 'Error registrando simulación en BD' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const formattedPrize = (prizeAmountCents / 100).toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ' €'

      cache.delete(cacheKey)

      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          simulated: true,
          prizeAmountCents,
          formattedPrize,
          checkSource: 'simulacion',
          listStatus: 'final',
          checkedAt: new Date().toISOString(),
          drawDate: effectiveDrawDate,
          recordData,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // -------------------------------------------------------------------------
    // NIVEL 2 — Histórico Oficial Integrado (2020–2025)
    // -------------------------------------------------------------------------
    const histResult = evaluateHistoricalDraw(effectiveDrawDate, effectiveDrawType, cleanNumber)
    if (histResult.found) {
      const prizeAmountCents = histResult.prizePerDecimoCents
      const checkSource = 'historico_oficial'
      const listStatus = 'final'

      // Registrar resultado oficial en BD vía record_ticket_prize_check
      const { data: recordData, error: rpcError } = await supabase.rpc(
        'record_ticket_prize_check',
        {
          p_ticket_id: ticketId,
          p_prize_amount_cents: prizeAmountCents,
          p_check_source: checkSource,
          p_list_status: listStatus,
        }
      )

      if (rpcError) {
        console.error('[check-prizes] Error registrando escrutinio histórico en RPC:', rpcError)
        return new Response(
          JSON.stringify({ error: rpcError.message || 'Error registrando comprobación en BD' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const formattedPrize = (prizeAmountCents / 100).toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ' €'

      cache.set(cacheKey, {
        prizeAmountCents,
        checkSource,
        listStatus,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      })

      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          prizeAmountCents,
          formattedPrize,
          prizeCategory: histResult.prizeCategory,
          checkSource,
          listStatus,
          checkedAt: new Date().toISOString(),
          drawDate: effectiveDrawDate,
          recordData,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // -------------------------------------------------------------------------
    // NIVEL 3 — Sorteos Futuros y en Vivo (2026+)
    // -------------------------------------------------------------------------
    if (!ticketNumber) {
      return new Response(
        JSON.stringify({ error: 'number es requerido para comprobación oficial' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const [yStr] = effectiveDrawDate.split('-')
    const drawYear = parseInt(yStr, 10)
    const formattedDrawDate = formatDrawDateShort(effectiveDrawDate)
    const drawStart = getDrawStartTimestamp(effectiveDrawDate, effectiveDrawType)

    // Obtener fecha actual en Madrid (Europe/Madrid)
    const now = new Date()
    const madridParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)

    const curY = parseInt(madridParts.find((p) => p.type === 'year')?.value || String(now.getFullYear()), 10)
    const curM = madridParts.find((p) => p.type === 'month')?.value || String(now.getMonth() + 1).padStart(2, '0')
    const curD = madridParts.find((p) => p.type === 'day')?.value || String(now.getDate()).padStart(2, '0')
    const todayStr = `${curY}-${curM}-${curD}`

    // Validación defensiva: sorteo futuro
    const isFuture = effectiveDrawDate > todayStr || (effectiveDrawDate === todayStr && now.getTime() < drawStart.getTime())
    if (isFuture) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'DRAW_NOT_HELD_YET',
          message: `Este sorteo se celebrará el ${formattedDrawDate}. Aún no hay resultados oficiales.`,
          drawDate: effectiveDrawDate,
          drawStart: drawStart.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Comprobar caché si no se fuerza refresco
    const cached = cache.get(cacheKey)
    if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          prizeAmountCents: cached.prizeAmountCents,
          formattedPrize: (cached.prizeAmountCents / 100).toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) + ' €',
          checkSource: cached.checkSource,
          listStatus: cached.listStatus,
          checkedAt: new Date().toISOString(),
          drawDate: effectiveDrawDate,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Consulta en vivo (para sorteos 2026+ en día de sorteo o celebrados)
    if (drawYear >= 2026) {
      const numInt = parseInt(cleanNumber, 10)
      const endpointUrl =
        effectiveDrawType === 'EL_NINO' || effectiveDrawDate.includes('-01-06')
          ? `https://api.elpais.com/ws/LoteriaNinoPremiados?n=${numInt}`
          : `https://api.elpais.com/ws/LoteriaNavidadPremiados?n=${numInt}`

      try {
        const res = await fetch(endpointUrl, {
          headers: { 'User-Agent': 'MisDecimos/1.0.55' },
        })

        if (res.ok) {
          const rawText = await res.text()
          const jsonText = rawText.replace(/^busqueda=/, '').replace(/;$/, '').trim()
          const data = JSON.parse(jsonText)

          if (data.error === 1 || data.status === 0 || data.status === '0') {
            if (effectiveDrawDate === todayStr) {
              return new Response(
                JSON.stringify({
                  ok: false,
                  code: 'DRAW_IN_PROGRESS',
                  message: 'El sorteo está en curso o aún no hay resultados oficiales publicados.',
                  drawDate: effectiveDrawDate,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            } else {
              return new Response(
                JSON.stringify({
                  ok: false,
                  code: 'RESULTS_UNAVAILABLE',
                  message: `No hay resultados disponibles en el proveedor oficial para el sorteo del ${formattedDrawDate}.`,
                  drawDate: effectiveDrawDate,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          }

          const premioEuros = Number(data.premio || 0)
          const prizeAmountCents = Math.round(premioEuros * 100)
          const checkSource = 'elpais'
          const listStatus = data.status === 4 || data.status === '4' ? 'final' : 'provisional'

          const { data: recordData, error: rpcError } = await supabase.rpc(
            'record_ticket_prize_check',
            {
              p_ticket_id: ticketId,
              p_prize_amount_cents: prizeAmountCents,
              p_check_source: checkSource,
              p_list_status: listStatus,
            }
          )

          if (rpcError) {
            console.error('[check-prizes] Error registrando comprobación en RPC:', rpcError)
            return new Response(
              JSON.stringify({ error: rpcError.message || 'Error registrando comprobación en BD' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          const formattedPrize = (prizeAmountCents / 100).toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) + ' €'

          const ttl = listStatus === 'final' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000
          cache.set(cacheKey, {
            prizeAmountCents,
            checkSource,
            listStatus,
            expiresAt: Date.now() + ttl,
          })

          return new Response(
            JSON.stringify({
              ok: true,
              success: true,
              prizeAmountCents,
              formattedPrize,
              checkSource,
              listStatus,
              checkedAt: new Date().toISOString(),
              drawDate: effectiveDrawDate,
              recordData,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } catch (err) {
        console.error('[check-prizes] Error consultando feed en vivo:', err)
      }
    }

    // Fallback para sorteos no cubiertos
    const isPastDraw = effectiveDrawDate < todayStr
    return new Response(
      JSON.stringify({
        ok: false,
        code: isPastDraw ? 'HISTORICAL_UNAVAILABLE' : 'DRAW_IN_PROGRESS',
        message: isPastDraw
          ? `No hay resultados históricos disponibles en el proveedor oficial para el sorteo del ${formattedDrawDate}.`
          : 'El sorteo está en curso o aún no hay resultados oficiales publicados.',
        drawDate: effectiveDrawDate,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    console.error('Error inesperado en check-prizes:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Error interno en Edge Function' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
