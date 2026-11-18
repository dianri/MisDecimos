import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

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

    const { ticketId, number, drawType, drawDate, forceRefresh } = await req.json()

    if (!ticketId || !number) {
      return new Response(
        JSON.stringify({ error: 'ticketId y number son requeridos' }),
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

    // 1. Obtener la verdad canónica del décimo en PostgreSQL
    let effectiveDrawDate = drawDate
    let effectiveDrawType = drawType

    const { data: ticketRow, error: ticketFetchErr } = await supabase
      .from('tickets')
      .select('draw_date, draw_type, status')
      .eq('id', ticketId)
      .single()

    if (!ticketFetchErr && ticketRow) {
      effectiveDrawDate = ticketRow.draw_date || effectiveDrawDate
      effectiveDrawType = ticketRow.draw_type || effectiveDrawType
    }

    // 2. Validación Defensiva de Inicio del Sorteo (Europe/Madrid)
    if (effectiveDrawDate) {
      // Hora oficial según sorteo: Navidad a las 09:00 CET, El Niño a las 12:00 CET (UTC+1 en Dic/Ene)
      const hour = effectiveDrawType === 'EL_NINO' ? 12 : 9
      const hourStr = String(hour).padStart(2, '0')
      const drawStart = new Date(`${effectiveDrawDate}T${hourStr}:00:00+01:00`)
      const now = new Date()

      if (now.getTime() < drawStart.getTime()) {
        console.log(`[check-prizes] Intento de comprobación prematuro bloqueado para billete ${ticketId}. Inicio: ${drawStart.toISOString()}, Ahora: ${now.toISOString()}`)
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'DRAW_NOT_HELD_YET',
            message: 'El sorteo aún no se ha realizado.',
            drawDate: effectiveDrawDate,
            drawStart: drawStart.toISOString(),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const cleanNumber = String(number).padStart(5, '0')
    const cacheKey = `${effectiveDrawType || 'NAVIDAD'}:${cleanNumber}`

    let prizeAmountCents = 0
    let checkSource = 'elpais'
    let listStatus = 'provisional'

    // 3. Comprobar caché si no se fuerza refresco
    const cached = cache.get(cacheKey)
    if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
      prizeAmountCents = cached.prizeAmountCents
      checkSource = cached.checkSource
      listStatus = cached.listStatus
    } else {
      // 4. Consulta oficial según sorteo
      const numInt = parseInt(cleanNumber, 10)

      if (effectiveDrawType === 'NAVIDAD') {
        try {
          const res = await fetch(`https://api.elpais.com/ws/LoteriaNavidadPremiados?n=${numInt}`, {
            headers: { 'User-Agent': 'MisDecimos/1.0.12' },
          })
          if (res.ok) {
            const rawText = await res.text()
            const jsonText = rawText.replace(/^busqueda=/, '').replace(/;$/, '').trim()
            const data = JSON.parse(jsonText)

            // Si el sorteo aún no tiene escrutinio oficial o devuelve error / status === 0
            if (data.error === 1 || data.status === 0 || data.status === '0') {
              console.log(`[check-prizes] Navidad en curso o sin escrutinio para ${cleanNumber}:`, data)
              return new Response(
                JSON.stringify({
                  ok: false,
                  code: 'DRAW_IN_PROGRESS',
                  message: 'El sorteo está en curso o aún no hay resultados oficiales publicados.',
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }

            const premioEuros = Number(data.premio || 0)
            prizeAmountCents = Math.round(premioEuros * 100)
            checkSource = 'elpais'
            listStatus = (data.status === 4 || data.status === '4') ? 'final' : 'provisional'
          } else {
            return new Response(
              JSON.stringify({
                ok: false,
                code: 'DRAW_IN_PROGRESS',
                message: 'No se pudo obtener resultados oficiales en este momento. Inténtalo más tarde.',
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } catch (err) {
          console.error('Error consultando El País Navidad:', err)
          return new Response(
            JSON.stringify({
              ok: false,
              code: 'DRAW_IN_PROGRESS',
              message: 'Error al contactar con la fuente oficial de resultados.',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else if (effectiveDrawType === 'EL_NINO') {
        try {
          const res = await fetch(`https://api.elpais.com/ws/LoteriaNinoPremiados?n=${numInt}`, {
            headers: { 'User-Agent': 'MisDecimos/1.0.12' },
          })
          if (res.ok) {
            const rawText = await res.text()
            const jsonText = rawText.replace(/^busqueda=/, '').replace(/;$/, '').trim()
            const data = JSON.parse(jsonText)

            if (data.error === 1 || data.status === 0 || data.status === '0') {
              console.log(`[check-prizes] El Niño en curso o sin escrutinio para ${cleanNumber}:`, data)
              return new Response(
                JSON.stringify({
                  ok: false,
                  code: 'DRAW_IN_PROGRESS',
                  message: 'El sorteo está en curso o aún no hay resultados oficiales publicados.',
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }

            const premioEuros = Number(data.premio || 0)
            prizeAmountCents = Math.round(premioEuros * 100)
            checkSource = 'elpais'
            listStatus = (data.status === 4 || data.status === '4') ? 'final' : 'provisional'
          } else {
            return new Response(
              JSON.stringify({
                ok: false,
                code: 'DRAW_IN_PROGRESS',
                message: 'No se pudo obtener resultados oficiales en este momento. Inténtalo más tarde.',
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } catch (err) {
          console.error('Error consultando El País El Niño:', err)
          return new Response(
            JSON.stringify({
              ok: false,
              code: 'DRAW_IN_PROGRESS',
              message: 'Error al contactar con la fuente oficial de resultados.',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        // Fallback para sorteos ordinarios o Loterias API si estuviese configurado
        const loteriasApiKey = Deno.env.get('LOTERIAS_API_KEY')
        if (loteriasApiKey) {
          try {
            const res = await fetch(`https://api.loteriasapi.com/api/v1/results/nacional/check?numbers=${cleanNumber}`, {
              headers: {
                'x-api-key': loteriasApiKey,
                'User-Agent': 'MisDecimos/1.0.12',
              },
            })
            if (res.ok) {
              const data = await res.json()
              const decimoPrize = data?.additionalData?.decimos?.[0]?.prize ?? 0
              prizeAmountCents = Math.round(Number(decimoPrize))
              checkSource = 'loteriasapi'
              listStatus = data?.listStatus || 'final'
            } else {
              return new Response(
                JSON.stringify({
                  ok: false,
                  code: 'DRAW_IN_PROGRESS',
                  message: 'Resultados no disponibles en este momento.',
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          } catch (err) {
            console.error('Error consultando Loterias API:', err)
            return new Response(
              JSON.stringify({
                ok: false,
                code: 'DRAW_IN_PROGRESS',
                message: 'Error al consultar Loterias API.',
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } else {
          return new Response(
            JSON.stringify({
              ok: false,
              code: 'DRAW_IN_PROGRESS',
              message: 'Resultados oficiales aún no disponibles para este sorteo.',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // 5. Guardar en caché en memoria si hay resultado legítimo
      const ttl = listStatus === 'final' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000
      cache.set(cacheKey, {
        prizeAmountCents,
        checkSource,
        listStatus,
        expiresAt: Date.now() + ttl,
      })
    }

    // 6. Persistencia Atómica vía Supabase RPC record_ticket_prize_check
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
      console.error('Error registrando comprobación en RPC:', rpcError)
      return new Response(
        JSON.stringify({ error: rpcError.message || 'Error registrando comprobación en BD' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const formattedPrize = (prizeAmountCents / 100).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €'

    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        prizeAmountCents,
        formattedPrize,
        checkSource,
        listStatus,
        checkedAt: new Date().toISOString(),
        recordData,
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
