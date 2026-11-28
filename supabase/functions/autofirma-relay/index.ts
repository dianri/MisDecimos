import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const VALID_ID_REGEX = /^[A-Za-z0-9]{1,64}$/

async function extractParams(req: Request): Promise<{ op: string; id: string; dat: string }> {
  const url = new URL(req.url)
  let op = (url.searchParams.get('op') || '').trim().toLowerCase()
  let id = (url.searchParams.get('id') || '').trim()
  let dat = url.searchParams.get('dat') || ''

  if (req.method === 'POST') {
    const contentType = (req.headers.get('content-type') || '').toLowerCase()
    try {
      if (contentType.includes('application/json')) {
        const body = (await req.json()) as Record<string, unknown>
        if (!op && typeof body.op === 'string') op = body.op.trim().toLowerCase()
        if (!id && typeof body.id === 'string') id = body.id.trim()
        if (!dat && typeof body.dat === 'string') dat = body.dat
      } else if (contentType.includes('multipart/form-data')) {
        const form = await req.formData()
        const fOp = form.get('op')
        const fId = form.get('id')
        const fDat = form.get('dat')
        if (!op && typeof fOp === 'string') op = fOp.trim().toLowerCase()
        if (!id && typeof fId === 'string') id = fId.trim()
        if (!dat && typeof fDat === 'string') dat = fDat
      } else {
        // application/x-www-form-urlencoded o texto plano estándar de @firma
        const rawBody = await req.text()
        if (rawBody) {
          const params = new URLSearchParams(rawBody)
          if (!op) op = (params.get('op') || '').trim().toLowerCase()
          if (!id) id = (params.get('id') || '').trim()
          if (!dat) dat = params.get('dat') || ''
        }
      }
    } catch {
      // Ignorar errores de parseo de cuerpo si ya venían en query params
    }
  }

  return { op, id, dat }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('ERR_METHOD', {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('ERR_CONFIG', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { op, id, dat } = await extractParams(req)

  if (!VALID_ID_REGEX.test(id)) {
    return new Response('ERR_INVALID_ID', {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  if (req.method === 'POST' && op === 'put') {
    if (!dat) {
      return new Response('ERR_EMPTY_DAT', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    const { error } = await supabase
      .from('autofirma_sessions')
      .upsert({ id, dat, created_at: new Date().toISOString() }, { onConflict: 'id' })

    if (error) {
      return new Response('ERR_STORAGE', {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    return new Response('OK', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  if (op === 'get') {
    // Limpieza defensiva de sesiones expiradas (> 10 minutos)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    await supabase.from('autofirma_sessions').delete().lt('created_at', tenMinutesAgo)

    const { data, error } = await supabase
      .from('autofirma_sessions')
      .select('dat')
      .eq('id', id)
      .maybeSingle()

    if (error || !data?.dat) {
      return new Response('NO_DATA', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    // Lectura única: eliminar sesión tras entregarla
    await supabase.from('autofirma_sessions').delete().eq('id', id)

    return new Response(data.dat, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response('ERR_INVALID_OP', {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  })
})
