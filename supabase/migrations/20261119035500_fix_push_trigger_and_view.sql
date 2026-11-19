-- ==============================================================================
-- Migración: 20261119035500_fix_push_trigger_and_view.sql
-- Descripción: Vista push_subscriptions y trigger con autenticación para Web Push
-- ==============================================================================

create or replace view public.push_subscriptions as
select * from public.web_push_subscriptions;

alter view public.push_subscriptions set (security_invoker = on);

-- Trigger de envío de Web Push con headers de autenticación (apikey + Bearer)
create or replace function public.trigger_send_push_notification()
returns trigger
language plpgsql
security definer set search_path = public, auth, net
as $$
declare
  v_has_active_push boolean;
  v_edge_url text := 'https://xmdghpyfrblmtjtevtru.supabase.co/functions/v1/send-push';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZGdocHlmcmJsbXRqdGV2dHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NjU2NzIsImV4cCI6MjExMDM0MTY3Mn0.W8VjcQB4nV8IPZGCKsAiZEF-xIza_CZMRdw8LY3f-QM';
begin
  -- Si es una notificación de prueba directa, la Edge Function ya envía el push directamente
  if NEW.type = 'PUSH_TEST' then
    return NEW;
  end if;

  -- Comprobar si el usuario destinatario tiene suscripciones push activas y push_enabled = true
  select exists (
    select 1
    from public.web_push_subscriptions s
    join public.profiles p on p.id = s.user_id
    where s.user_id = NEW.user_id
      and s.is_active = true
      and p.push_enabled = true
  ) into v_has_active_push;

  if v_has_active_push then
    begin
      -- Invocación asíncrona no bloqueante mediante pg_net con headers de autenticación
      perform net.http_post(
        url := v_edge_url,
        body := jsonb_build_object(
          'userId', NEW.user_id,
          'title', NEW.title,
          'body', NEW.body,
          'actionUrl', NEW.action_url,
          'metadata', NEW.metadata
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', v_anon_key,
          'Authorization', 'Bearer ' || v_anon_key
        )
      );
    exception when others then
      -- Nunca bloquear una transacción de negocio si falla la red externa
      raise notice 'Error en trigger net.http_post para send-push: %', SQLERRM;
    end;
  end if;

  return NEW;
end;
$$;

drop trigger if exists on_notification_created_send_push on public.notifications;
create trigger on_notification_created_send_push
  after insert on public.notifications
  for each row
  execute function public.trigger_send_push_notification();
