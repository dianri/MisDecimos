-- ==============================================================================
-- Migración: 20261115000003_prize_check_and_payouts.sql
-- Descripción: Funciones RPC para comprobación oficial de premios, liquidación y recordatorios de pago
-- ==============================================================================

-- 1. record_ticket_prize_check
create or replace function public.record_ticket_prize_check(
  p_ticket_id uuid,
  p_prize_amount_cents bigint,
  p_check_source text,
  p_list_status text default 'final'
)
returns jsonb
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_ticket record;
  v_is_authorized boolean := false;
  v_new_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'Décimo no encontrado';
  end if;

  -- Comprobar si el usuario es el propietario o un participante con cuota ACEPTADA
  if v_ticket.owner_id = v_user_id then
    v_is_authorized := true;
  else
    select exists (
      select 1 from public.ownership_shares
      where ticket_id = p_ticket_id and user_id = v_user_id and status = 'ACEPTADA'
    ) into v_is_authorized;
  end if;

  if not v_is_authorized then
    raise exception 'No tienes permisos para registrar la comprobación de este décimo';
  end if;

  -- Determinar nuevo estado (si está PENDIENTE y se comprueba, pasa a VALIDADO)
  v_new_status := v_ticket.status;
  if v_ticket.status = 'PENDIENTE' then
    v_new_status := 'VALIDADO';
  end if;

  -- Actualizar el billete
  update public.tickets
  set
    prize_amount_cents = p_prize_amount_cents,
    last_checked_at = now(),
    check_source = p_check_source,
    status = v_new_status,
    updated_at = now()
  where id = p_ticket_id;

  -- Insertar evento inmutable de auditoría
  insert into public.audit_events (
    ticket_id,
    actor_id,
    action,
    metadata
  ) values (
    p_ticket_id,
    v_user_id,
    'PREMIO_COMPROBADO',
    jsonb_build_object(
      'prize_amount_cents', p_prize_amount_cents,
      'check_source', p_check_source,
      'list_status', p_list_status,
      'checked_at', now()
    )
  );

  -- Si tiene premio (> 0), notificar a todos los cotitulares con cuota ACEPTADA
  if p_prize_amount_cents > 0 then
    insert into public.notifications (
      user_id,
      ticket_id,
      type,
      title,
      body,
      action_url,
      metadata
    )
    select
      s.user_id,
      p_ticket_id,
      'PRIZE_WON',
      '¡Décimo premiado!',
      'El décimo Nº ' || v_ticket.number || ' ha obtenido un premio de ' ||
        to_char(p_prize_amount_cents / 100.0, 'FM999G999G999D00') || ' €. ' ||
        'Tu parte (' || s.percentage || '%) asciende a ' ||
        to_char((p_prize_amount_cents / 100.0) * (s.percentage / 100.0), 'FM999G999G999D00') || ' €.',
      '/billete/' || p_ticket_id,
      jsonb_build_object(
        'prize_amount_cents', p_prize_amount_cents,
        'percentage', s.percentage,
        'proportional_prize_cents', round((p_prize_amount_cents::numeric) * (s.percentage / 100.0))
      )
    from public.ownership_shares s
    where s.ticket_id = p_ticket_id and s.status = 'ACEPTADA' and s.percentage > 0;
  end if;

  return jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'prize_amount_cents', p_prize_amount_cents,
    'status', v_new_status,
    'check_source', p_check_source,
    'list_status', p_list_status,
    'last_checked_at', now()
  );
end;
$$;

-- 2. request_payout_confirmation_reminder
create or replace function public.request_payout_confirmation_reminder(
  p_ticket_id uuid
)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_ticket record;
  v_is_owner boolean;
  v_participant_record record;
  v_pending_count int := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Décimo no encontrado';
  end if;

  if v_ticket.prize_amount_cents <= 0 then
    raise exception 'El décimo no tiene premio a liquidar';
  end if;

  v_is_owner := (v_ticket.owner_id = v_user_id);

  if v_is_owner then
    -- Recordatorio del propietario a los participantes pendientes
    for v_participant_record in
      select s.*, p.display_name
      from public.ownership_shares s
      left join public.profiles p on p.id = s.user_id
      where s.ticket_id = p_ticket_id
        and s.role = 'PARTICIPANTE'
        and s.status = 'ACEPTADA'
        and s.percentage > 0
        and s.prize_paid_confirmed = false
    loop
      v_pending_count := v_pending_count + 1;

      -- Notificación al participante
      insert into public.notifications (
        user_id, ticket_id, type, title, body, action_url, metadata
      ) values (
        v_participant_record.user_id,
        p_ticket_id,
        'PAYOUT_REMINDER',
        'Recordatorio de cobro de premio',
        'El custodio del décimo Nº ' || v_ticket.number || ' te solicita confirmar si has recibido tu parte del premio (' ||
          to_char((v_ticket.prize_amount_cents / 100.0) * (v_participant_record.percentage / 100.0), 'FM999G999G999D00') || ' €).',
        '/billete/' || p_ticket_id,
        jsonb_build_object('share_id', v_participant_record.id)
      );
    end loop;

    -- Auditoría
    insert into public.audit_events (
      ticket_id, actor_id, action, metadata
    ) values (
      p_ticket_id,
      v_user_id,
      'SOLICITUD_VALIDAR_COBRO',
      jsonb_build_object('recipient_role', 'PARTICIPANTES', 'pending_count', v_pending_count)
    );
  else
    -- Un participante notifica al propietario sobre el premio
    insert into public.notifications (
      user_id, ticket_id, type, title, body, action_url, metadata
    ) values (
      v_ticket.owner_id,
      p_ticket_id,
      'PAYOUT_REMINDER',
      'Solicitud de cobro de premio',
      'Un cotitular del décimo Nº ' || v_ticket.number || ' ha consultado el estado de liquidación del premio.',
      '/billete/' || p_ticket_id,
      jsonb_build_object('requested_by', v_user_id)
    );

    -- Auditoría
    insert into public.audit_events (
      ticket_id, actor_id, target_user_id, action, metadata
    ) values (
      p_ticket_id,
      v_user_id,
      v_ticket.owner_id,
      'SOLICITUD_VALIDAR_COBRO',
      jsonb_build_object('recipient_role', 'PROPIETARIO')
    );
  end if;

  return true;
end;
$$;

-- 3. Actualización de confirm_prize_received
create or replace function public.confirm_prize_received(
  p_ticket_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_ticket record;
  v_share record;
  v_pending_count int;
  v_new_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'Décimo no encontrado';
  end if;

  if v_ticket.prize_amount_cents <= 0 then
    raise exception 'El décimo no tiene premio registrado';
  end if;

  select * into v_share
  from public.ownership_shares
  where ticket_id = p_ticket_id and user_id = v_user_id and status = 'ACEPTADA' and percentage > 0
  for update;

  if not found then
    raise exception 'No posees una participación activa con premio en este décimo';
  end if;

  -- Confirmar cobro para este participante o propietario
  update public.ownership_shares
  set prize_paid_confirmed = true, prize_paid_confirmed_at = now(), updated_at = now()
  where id = v_share.id;

  -- Registrar en auditoría
  insert into public.audit_events (ticket_id, actor_id, action, percentage, metadata)
  values (
    p_ticket_id, v_user_id, 'COBRO_PREMIO_CONFIRMADO', v_share.percentage,
    jsonb_build_object(
      'share_id', v_share.id,
      'role', v_share.role,
      'prize_amount_cents', v_ticket.prize_amount_cents,
      'proportional_prize_cents', round((v_ticket.prize_amount_cents::numeric) * (v_share.percentage / 100.0))
    )
  );

  -- Notificar al propietario si quien confirma es participante
  if v_user_id != v_ticket.owner_id then
    insert into public.notifications (user_id, ticket_id, type, title, body, action_url)
    values (
      v_ticket.owner_id, p_ticket_id, 'PRIZE_COLLECTED',
      'Cobro de premio confirmado',
      'Un participante ha confirmado la recepción de su parte del premio en el décimo Nº ' || v_ticket.number,
      '/billete/' || p_ticket_id
    );
  end if;

  -- Comprobar si TODOS los cotitulares con cuota > 0 han confirmado su cobro
  select count(*) into v_pending_count
  from public.ownership_shares
  where ticket_id = p_ticket_id and status = 'ACEPTADA' and percentage > 0 and prize_paid_confirmed = false;

  v_new_status := v_ticket.status;

  if v_pending_count = 0 then
    v_new_status := 'LIQUIDADO';
    update public.tickets
    set status = 'LIQUIDADO', updated_at = now()
    where id = p_ticket_id;

    insert into public.audit_events (ticket_id, actor_id, action, metadata)
    values (
      p_ticket_id, v_user_id, 'DECIMO_LIQUIDADO',
      jsonb_build_object('liquidated_at', now(), 'total_prize_cents', v_ticket.prize_amount_cents)
    );

    -- Notificar a todos los cotitulares que el décimo ha sido liquidado
    insert into public.notifications (user_id, ticket_id, type, title, body, action_url)
    select user_id, p_ticket_id, 'TICKET_LIQUIDATED',
      'Décimo totalmente liquidado',
      'Todos los cotitulares del décimo Nº ' || v_ticket.number || ' han confirmado la recepción de su premio. ¡Décimo completado!',
      '/billete/' || p_ticket_id
    from public.ownership_shares
    where ticket_id = p_ticket_id and status = 'ACEPTADA' and percentage > 0;
  end if;

  return jsonb_build_object(
    'success', true,
    'ticket_status', v_new_status,
    'fully_liquidated', (v_pending_count = 0)
  );
end;
$$;
