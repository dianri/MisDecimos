-- ==============================================================================
-- Migración: 20261119041500_push_notification_deeplink_trigger.sql
-- Descripción: Enriquecer payload de Web Push con ticket_id, notification_id y deep-link
-- ==============================================================================

create or replace function public.trigger_send_push_notification()
returns trigger
language plpgsql
security definer set search_path = public, auth, net
as $$
declare
  v_has_active_push boolean;
  v_edge_url text := 'https://xmdghpyfrblmtjtevtru.supabase.co/functions/v1/send-push';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZGdocHlmcmJsbXRqdGV2dHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NjU2NzIsImV4cCI6MjExMDM0MTY3Mn0.W8VjcQB4nV8IPZGCKsAiZEF-xIza_CZMRdw8LY3f-QM';
  v_ticket_id text;
  v_target_url text;
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
      -- Resolver ticket_id prioritario desde columna o metadata
      v_ticket_id := coalesce(NEW.ticket_id::text, NEW.metadata->>'ticket_id');

      -- Construir URL canónica de destino para deep-linking directo
      if v_ticket_id is not null and v_ticket_id <> '' then
        v_target_url := '/billetes/' || v_ticket_id;
      elsif NEW.action_url is not null and NEW.action_url <> '' then
        v_target_url := NEW.action_url;
      else
        v_target_url := '/alertas';
      end if;

      -- Invocación asíncrona no bloqueante mediante pg_net con headers de autenticación
      perform net.http_post(
        url := v_edge_url,
        body := jsonb_build_object(
          'userId', NEW.user_id,
          'notificationId', NEW.id,
          'notification_id', NEW.id,
          'ticketId', v_ticket_id,
          'ticket_id', v_ticket_id,
          'title', NEW.title,
          'body', NEW.body,
          'actionUrl', v_target_url,
          'url', v_target_url,
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
