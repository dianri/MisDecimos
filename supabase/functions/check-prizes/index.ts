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

    if (!effectiveDrawDate) {
      effectiveDrawDate = new Date().toISOString().split('T')[0]
    }

    const [yStr, mStr, dStr] = effectiveDrawDate.split('-')
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

    // 2. Validación Defensiva de Inicio del Sorteo
    const isFuture = effectiveDrawDate > todayStr || (effectiveDrawDate === todayStr && now.getTime() < drawStart.getTime())
    if (isFuture) {
      console.log(`[check-prizes] Intento de comprobación prematuro bloqueado para billete ${ticketId}. Inicio: ${drawStart.toISOString()}, Ahora: ${now.toISOString()}`)
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

    const cleanNumber = String(number).padStart(5, '0')
    const cacheKey = `${effectiveDrawDate}:${effectiveDrawType || 'NAVIDAD'}:${cleanNumber}`

    let prizeAmountCents = 0
    let checkSource = 'oficial'
    let listStatus = 'provisional'

    // 3. Comprobar caché si no se fuerza refresco
    const cached = cache.get(cacheKey)
    if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
      prizeAmountCents = cached.prizeAmountCents
      checkSource = cached.checkSource
      listStatus = cached.listStatus
    } else {
      const isPastDraw = effectiveDrawDate < todayStr
      const isCurrentEdition = drawYear === curY
      const loteriasApiKey = Deno.env.get('LOTERIAS_API_KEY')
      let providerResolved = false

      // 4. Intentar Loterías API con fecha explícita si la clave está disponible
      if (loteriasApiKey) {
        try {
          const res = await fetch(
            `https://api.loteriasapi.com/api/v1/results/nacional/check?numbers=${cleanNumber}&date=${effectiveDrawDate}`,
            {
              headers: {
                'x-api-key': loteriasApiKey,
                'User-Agent': 'MisDecimos/1.0.39',
              },
            }
          )
          if (res.ok) {
            const data = await res.json()
            if (data?.additionalData?.decimos && data.additionalData.decimos.length > 0) {
              const decimoPrize = data.additionalData.decimos[0].prize ?? 0
              prizeAmountCents = Math.round(Number(decimoPrize) * 100)
              checkSource = 'loteriasapi'
              listStatus = data?.listStatus || 'final'
              providerResolved = true
            }
          }
        } catch (err) {
          console.warn('[check-prizes] Error consultando Loterias API con fecha:', err)
        }
      }

      // 5. Consulta a El País (solo aplicable a la temporada actual)
      if (!providerResolved) {
        if (isCurrentEdition) {
          const numInt = parseInt(cleanNumber, 10)
          const endpointUrl =
            effectiveDrawType === 'EL_NINO' || effectiveDrawDate.includes('-01-06')
              ? `https://api.elpais.com/ws/LoteriaNinoPremiados?n=${numInt}`
              : `https://api.elpais.com/ws/LoteriaNavidadPremiados?n=${numInt}`

          try {
            const res = await fetch(endpointUrl, {
              headers: { 'User-Agent': 'MisDecimos/1.0.39' },
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
                      code: 'HISTORICAL_UNAVAILABLE',
                      message: `No hay resultados históricos disponibles en el proveedor oficial para el sorteo del ${formattedDrawDate}.`,
                      drawDate: effectiveDrawDate,
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                  )
                }
              }

              const premioEuros = Number(data.premio || 0)
              prizeAmountCents = Math.round(premioEuros * 100)
              checkSource = 'elpais'
              listStatus = data.status === 4 || data.status === '4' ? 'final' : 'provisional'
              providerResolved = true
            }
          } catch (err) {
            console.error('[check-prizes] Error consultando El País:', err)
          }
        } else {
          // El sorteo es de un año anterior (drawYear !== curY) y El País no dispone de archivo histórico por año
          console.log(`[check-prizes] Sorteo histórico ${effectiveDrawDate} (año ${drawYear} != ${curY}) sin proveedor de archivo`)
          return new Response(
            JSON.stringify({
              ok: false,
              code: 'HISTORICAL_UNAVAILABLE',
              message: `No hay resultados históricos disponibles en el proveedor oficial para el sorteo del ${formattedDrawDate}.`,
              drawDate: effectiveDrawDate,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Si ningún proveedor pudo resolver el escrutinio
      if (!providerResolved) {
        if (isPastDraw) {
          return new Response(
            JSON.stringify({
              ok: false,
              code: 'HISTORICAL_UNAVAILABLE',
              message: `No hay resultados históricos disponibles en el proveedor oficial para el sorteo del ${formattedDrawDate}.`,
              drawDate: effectiveDrawDate,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          return new Response(
            JSON.stringify({
              ok: false,
              code: 'DRAW_IN_PROGRESS',
              message: 'El sorteo está en curso o aún no hay resultados oficiales publicados.',
              drawDate: effectiveDrawDate,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // 6. Guardar en caché en memoria si hay resultado legítimo
      const ttl = listStatus === 'final' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000
      cache.set(cacheKey, {
        prizeAmountCents,
        checkSource,
        listStatus,
        expiresAt: Date.now() + ttl,
      })
    }

    // 7. Persistencia Atómica vía Supabase RPC record_ticket_prize_check
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
        drawDate: effectiveDrawDate,
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
