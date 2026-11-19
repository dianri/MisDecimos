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
    let ticketId =
      payload.ticketId ||
      payload.ticket_id ||
      payload.metadata?.ticket_id ||
      payload.metadata?.ticketId ||
      null
    let notificationId =
      payload.notificationId ||
      payload.notification_id ||
      payload.metadata?.notification_id ||
      payload.metadata?.notificationId ||
      null

    let actionUrl = payload.actionUrl || payload.url
    if (!actionUrl) {
      actionUrl = ticketId ? `/billetes/${ticketId}` : '/alertas'
    } else if (ticketId && actionUrl === '/alertas') {
      // Si se incluye ticketId pero la acción por defecto era /alertas, priorizar el décimo
      actionUrl = `/billetes/${ticketId}`
    }

    // Extraer ticketId de la URL si no venía en los parámetros
    if (!ticketId && actionUrl) {
      const match = actionUrl.match(
        /\/(?:billetes|billete|decimos|decimo|tickets|ticket)\/([a-zA-Z0-9_-]+)/i
      )
      if (match && match[1]) {
        ticketId = match[1]
      }
    }

    const tag =
      payload.tag || (ticketId ? `misdecimos-ticket-${ticketId}` : 'misdecimos-alert')
    const metadata = {
      ...(payload.metadata || {}),
      ...(ticketId ? { ticket_id: ticketId } : {}),
      ...(notificationId ? { notification_id: notificationId } : {}),
    }

    // Modo B: Notificación de prueba
    if (payload.testPush) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(
          JSON.stringify({
            error: 'Falta cabecera Authorization para prueba push',
            sent: 0,
            failed: 1,
            errors: ['Falta cabecera Authorization'],
          }),
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
          JSON.stringify({
            error: 'Token inválido o expirado',
            sent: 0,
            failed: 1,
            errors: ['Token de usuario inválido o expirado'],
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      targetUserId = user.id
      title = '🔔 Notificación de Prueba — MisDecimos'
      body = '¡Excelente! Las notificaciones Web Push están activadas y funcionando en este dispositivo.'
      actionUrl = '/perfil'
      ticketId = null

      // Registrar notificación en la base de datos (con type PUSH_TEST para que el trigger no duplique el envío)
      const { data: testNotif } = await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          type: 'PUSH_TEST',
          title,
          body,
          action_url: actionUrl,
          is_read: false,
          metadata: { is_test: true, sent_at: new Date().toISOString() },
        })
        .select('id')
        .single()

      if (testNotif?.id) {
        notificationId = testNotif.id
      }
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({
          error: 'Se requiere userId o testPush: true',
          sent: 0,
          failed: 1,
          errors: ['Falta parámetro userId en la solicitud'],
        }),
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
          sent: 0,
          failed: 0,
          errors: ['El usuario tiene push_enabled en false'],
          sentCount: 0,
          totalSubscriptions: 0,
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
        JSON.stringify({
          error: 'Error consultando suscripciones push',
          sent: 0,
          failed: 1,
          errors: [subsError.message],
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No hay dispositivos suscritos activos para este usuario.',
          sent: 0,
          failed: 0,
          errors: ['Sin suscripción push activa registrada para este usuario'],
          sentCount: 0,
          totalSubscriptions: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let sentCount = 0
    let failedCount = 0
    let deactivatedCount = 0
    const errors: string[] = []

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
        actionUrl,
        ticketId,
        ticket_id: ticketId,
        notificationId,
        notification_id: notificationId,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag,
        data: {
          url: actionUrl,
          ticketId,
          ticket_id: ticketId,
          notificationId,
          notification_id: notificationId,
          metadata,
        },
      })

      try {
        await webpush.sendNotification(pushSubscription, pushData)
        sentCount++
      } catch (err: unknown) {
        failedCount++
        const errorStatus = (err as { statusCode?: number })?.statusCode
        const errorMsg = (err as Error)?.message || String(err)
        errors.push(`Endpoint ${sub.id} (HTTP ${errorStatus}): ${errorMsg}`)
        console.error(
          `Error enviando push al endpoint ${sub.id} (status ${errorStatus}):`,
          errorMsg
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
        sent: sentCount,
        failed: failedCount,
        errors,
        sentCount,
        deactivatedCount,
        totalSubscriptions: subscriptions.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    console.error('Error inesperado en send-push:', err)
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Error interno en Edge Function',
        sent: 0,
        failed: 1,
        errors: [err instanceof Error ? err.message : 'Error interno'],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})