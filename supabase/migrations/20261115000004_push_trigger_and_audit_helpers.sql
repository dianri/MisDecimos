-- ==============================================================================
-- Migración: 20261115000004_push_trigger_and_audit_helpers.sql
-- Descripción: RPC mark_all_notifications_read y trigger asíncrono para Web Push
-- ==============================================================================

create extension if not exists pg_net;

-- 1. mark_all_notifications_read
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  update public.notifications
  set is_read = true
  where user_id = v_user_id and is_read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 2. Función y Trigger de envío de Web Push al insertar en notifications
create or replace function public.trigger_send_push_notification()
returns trigger
language plpgsql
security definer set search_path = public, auth, net
as $$
declare
  v_has_active_push boolean;
  v_edge_url text := 'https://xmdghpyfrblmtjtevtru.supabase.co/functions/v1/send-push';
begin
  -- Comprobar si el usuario destinatario tiene suscripciones push activas
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
      -- Invocación asíncrona no bloqueante mediante pg_net
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
          'Content-Type', 'application/json'
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
