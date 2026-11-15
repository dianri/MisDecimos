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

    const { ticketId, number, drawType, ticketPrice, forceRefresh } = await req.json()

    if (!ticketId || !number) {
      return new Response(
        JSON.stringify({ error: 'ticketId y number son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cleanNumber = String(number).padStart(5, '0')
    const cacheKey = `${drawType || 'NAVIDAD'}:${cleanNumber}`

    let prizeAmountCents = 0
    let checkSource = 'elpais'
    let listStatus = 'provisional'

    // 1. Comprobar caché si no se fuerza refresco
    const cached = cache.get(cacheKey)
    if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
      prizeAmountCents = cached.prizeAmountCents
      checkSource = cached.checkSource
      listStatus = cached.listStatus
    } else {
      // 2. Consulta oficial según sorteo
      const numInt = parseInt(cleanNumber, 10)

      if (drawType === 'NAVIDAD') {
        try {
          const res = await fetch(`https://api.elpais.com/ws/LoteriaNavidadPremiados?n=${numInt}`, {
            headers: { 'User-Agent': 'MisDecimos/0.5.0' },
          })
          if (res.ok) {
            const rawText = await res.text()
            const jsonText = rawText.replace(/^busqueda=/, '').replace(/;$/, '').trim()
            const data = JSON.parse(jsonText)
            const premioEuros = Number(data.premio || 0)
            prizeAmountCents = Math.round(premioEuros * 100)
            checkSource = 'elpais'
            listStatus = (data.status === 4 || data.status === '4') ? 'final' : 'provisional'
          } else {
            listStatus = 'sin_resultados_aun'
          }
        } catch (err) {
          console.error('Error consultando El País Navidad:', err)
          listStatus = 'sin_resultados_aun'
        }
      } else if (drawType === 'EL_NINO') {
        try {
          const res = await fetch(`https://api.elpais.com/ws/LoteriaNinoPremiados?n=${numInt}`, {
            headers: { 'User-Agent': 'MisDecimos/0.5.0' },
          })
          if (res.ok) {
            const rawText = await res.text()
            const jsonText = rawText.replace(/^busqueda=/, '').replace(/;$/, '').trim()
            const data = JSON.parse(jsonText)
            const premioEuros = Number(data.premio || 0)
            prizeAmountCents = Math.round(premioEuros * 100)
            checkSource = 'elpais'
            listStatus = (data.status === 4 || data.status === '4') ? 'final' : 'provisional'
          } else {
            listStatus = 'sin_resultados_aun'
          }
        } catch (err) {
          console.error('Error consultando El País El Niño:', err)
          listStatus = 'sin_resultados_aun'
        }
      } else {
        // Sorteos ordinarios (JUEVES, SABADO, ESPECIAL) o Fallback con LOTERIAS_API_KEY
        const loteriasApiKey = Deno.env.get('LOTERIAS_API_KEY')
        if (loteriasApiKey) {
          try {
            const res = await fetch(`https://api.loteriasapi.com/api/v1/results/nacional/check?numbers=${cleanNumber}`, {
              headers: {
                'x-api-key': loteriasApiKey,
                'User-Agent': 'MisDecimos/0.5.0',
              },
            })
            if (res.ok) {
              const data = await res.json()
              const decimoPrize = data?.additionalData?.decimos?.[0]?.prize ?? 0
              prizeAmountCents = Math.round(Number(decimoPrize))
              checkSource = 'loteriasapi'
              listStatus = data?.listStatus || 'final'
            } else {
              listStatus = 'sin_resultados_aun'
            }
          } catch (err) {
            console.error('Error consultando Loterias API:', err)
            listStatus = 'sin_resultados_aun'
          }
        } else {
          // Si no hay API key para sorteos ordinarios
          checkSource = 'elpais'
          listStatus = 'sin_resultados_aun'
        }
      }

      // 3. Guardar en caché en memoria
      const ttl = listStatus === 'final' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000
      cache.set(cacheKey, {
        prizeAmountCents,
        checkSource,
        listStatus,
        expiresAt: Date.now() + ttl,
      })
    }

    // 4. Persistencia Atómica vía Supabase RPC record_ticket_prize_check
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

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
