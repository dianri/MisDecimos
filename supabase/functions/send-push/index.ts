import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import webpush from "npm:web-push@3.6.7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Configurar VAPID en web-push
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || ''
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:soporte@dianrie.com'

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    } else {
      console.warn('⚠️ Claves VAPID no configuradas en secretos de Supabase.')
    }

    const payload = await req.json().catch(() => ({}))

    let targetUserId = payload.userId
    let title = payload.title || 'MisDecimos'
    let body = payload.body || ''
    let actionUrl = payload.actionUrl || payload.url || '/'
    const tag = payload.tag || 'misdecimos-alert'
    const metadata = payload.metadata || {}

    // Modo B: Notificación de prueba
    if (payload.testPush) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Falta cabecera Authorization para prueba push' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const token = authHeader.replace('Bearer ', '').trim()
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser(token)

      if (userErr || !user) {
        return new Response(
          JSON.stringify({ error: 'Token inválido o expirado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      targetUserId = user.id
      title = '🔔 Notificación de Prueba — MisDecimos'
      body = '¡Excelente! Las notificaciones Web Push están activadas y funcionando en este dispositivo.'
      actionUrl = '/perfil'

      // Registrar notificación en la base de datos
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        type: 'PUSH_TEST',
        title,
        body,
        action_url: actionUrl,
        is_read: false,
        metadata: { is_test: true, sent_at: new Date().toISOString() },
      })
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Se requiere userId o testPush: true' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Comprobar si el usuario tiene las notificaciones push activadas en su perfil
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_enabled')
      .eq('id', targetUserId)
      .single()

    if (profile && profile.push_enabled === false) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'El usuario tiene las notificaciones push desactivadas en su perfil.',
          sentCount: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar todas las suscripciones push activas del usuario
    const { data: subscriptions, error: subsError } = await supabase
      .from('web_push_subscriptions')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('is_active', true)

    if (subsError) {
      console.error('Error consultando web_push_subscriptions:', subsError)
      return new Response(
        JSON.stringify({ error: 'Error consultando suscripciones push' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No hay dispositivos suscritos activos para este usuario.',
          sentCount: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let sentCount = 0
    let deactivatedCount = 0

    // Enviar a cada suscripción activa
    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }

      const pushData = JSON.stringify({
        title,
        body,
        url: actionUrl,
        icon: '/pwa-192x192.png',
        badge: '/badge-mono.png',
        tag,
        data: {
          url: actionUrl,
          metadata,
        },
      })

      try {
        await webpush.sendNotification(pushSubscription, pushData)
        sentCount++
      } catch (err: unknown) {
        const errorStatus = (err as { statusCode?: number })?.statusCode
        console.error(
          `Error enviando push al endpoint ${sub.id} (status ${errorStatus}):`,
          (err as Error)?.message || err
        )

        // Si la suscripción ha sido revocada por el navegador o dispositivo (404 o 410 Gone)
        if (errorStatus === 404 || errorStatus === 410) {
          await supabase
            .from('web_push_subscriptions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', sub.id)
          deactivatedCount++
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        deactivatedCount,
        totalSubscriptions: subscriptions.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    console.error('Error inesperado en send-push:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Error interno en Edge Function' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
