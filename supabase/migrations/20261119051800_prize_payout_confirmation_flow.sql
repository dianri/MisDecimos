-- ============================================================================
-- MIGRACIÓN: Flujo de Solicitud y Confirmación de Cobro de Premios por Participación
-- Timestamp: 20261119051800
-- ============================================================================

-- 1. Columnas de seguimiento en ownership_shares
alter table public.ownership_shares
  add column if not exists prize_payout_requested_at timestamptz null,
  add column if not exists prize_payout_requested_by uuid null references auth.users(id);

-- 2. RPC: request_prize_payout_confirmation
create or replace function public.request_prize_payout_confirmation(
  p_share_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_share record;
  v_ticket record;
  v_prop_prize_cents bigint;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_share
  from public.ownership_shares
  where id = p_share_id
  for update;

  if not found then
    raise exception 'Participación no encontrada';
  end if;

  select * into v_ticket
  from public.tickets
  where id = v_share.ticket_id
  for update;

  if not found then
    raise exception 'Décimo no encontrado';
  end if;

  -- Solo el propietario/custodio del décimo puede solicitar la confirmación de cobro
  if v_ticket.owner_id != v_user_id then
    raise exception 'Solo el custodio del décimo puede solicitar la confirmación de cobro';
  end if;

  if v_ticket.prize_amount_cents <= 0 then
    raise exception 'El décimo no tiene premio registrado';
  end if;

  if v_share.status != 'ACEPTADA' or v_share.percentage <= 0 then
    raise exception 'La participación no se encuentra aceptada o no tiene porcentaje';
  end if;

  if v_share.prize_paid_confirmed = true then
    raise exception 'Esta participación ya ha sido confirmada como cobrada';
  end if;

  -- Calcular premio proporcional en céntimos
  v_prop_prize_cents := round((v_ticket.prize_amount_cents::numeric) * (v_share.percentage / 100.0));

  -- Actualizar registro en ownership_shares
  update public.ownership_shares
  set
    prize_payout_requested_at = now(),
    prize_payout_requested_by = v_user_id,
    updated_at = now()
  where id = p_share_id;

  -- Registrar en auditoría
  insert into public.audit_events (
    ticket_id,
    actor_id,
    target_user_id,
    action,
    percentage,
    metadata
  ) values (
    v_ticket.id,
    v_user_id,
    v_share.user_id,
    'SOLICITUD_CONFIRMACION_COBRO',
    v_share.percentage,
    jsonb_build_object(
      'share_id', v_share.id,
      'prize_amount_cents', v_ticket.prize_amount_cents,
      'proportional_prize_cents', v_prop_prize_cents,
      'requested_at', now()
    )
  );

  -- Notificar al cotitular (dispara Web Push nativo mediante trigger)
  insert into public.notifications (
    user_id,
    ticket_id,
    type,
    title,
    body,
    action_url,
    metadata
  ) values (
    v_share.user_id,
    v_ticket.id,
    'PAYOUT_REMINDER',
    'Solicitud de confirmación de cobro',
    'El custodio del décimo Nº ' || v_ticket.number || ' te solicita confirmar si has recibido tu parte del premio (' ||
      to_char(v_prop_prize_cents / 100.0, 'FM999G999G999D00') || ' €).',
    '/billete/' || v_ticket.id,
    jsonb_build_object(
      'ticket_id', v_ticket.id,
      'share_id', v_share.id,
      'proportional_prize_cents', v_prop_prize_cents
    )
  );

  return jsonb_build_object(
    'success', true,
    'share_id', p_share_id,
    'requested_at', now(),
    'proportional_prize_cents', v_prop_prize_cents
  );
end;
$$;

-- 3. RPC: confirm_prize_payout_received
create or replace function public.confirm_prize_payout_received(
  p_share_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_share record;
  v_ticket record;
  v_prop_prize_cents bigint;
  v_pending_count int;
  v_new_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_share
  from public.ownership_shares
  where id = p_share_id
  for update;

  if not found then
    raise exception 'Participación no encontrada';
  end if;

  select * into v_ticket
  from public.tickets
  where id = v_share.ticket_id
  for update;

  if not found then
    raise exception 'Décimo no encontrado';
  end if;

  -- Solo el cotitular titular de la cuota (o el custodio si es su propia cuota) puede confirmar
  if v_share.user_id != v_user_id then
    raise exception 'Solo el titular de la participación puede confirmar la recepción del premio';
  end if;

  if v_share.status != 'ACEPTADA' or v_share.percentage <= 0 then
    raise exception 'La participación no se encuentra aceptada o no tiene porcentaje';
  end if;

  if v_ticket.prize_amount_cents <= 0 then
    raise exception 'El décimo no tiene premio registrado';
  end if;

  v_prop_prize_cents := round((v_ticket.prize_amount_cents::numeric) * (v_share.percentage / 100.0));

  -- Marcar confirmación de cobro
  update public.ownership_shares
  set
    prize_paid_confirmed = true,
    prize_paid_confirmed_at = now(),
    updated_at = now()
  where id = p_share_id;

  -- Registrar en auditoría
  insert into public.audit_events (
    ticket_id,
    actor_id,
    action,
    percentage,
    metadata
  ) values (
    v_ticket.id,
    v_user_id,
    'COBRO_PREMIO_CONFIRMADO',
    v_share.percentage,
    jsonb_build_object(
      'share_id', v_share.id,
      'role', v_share.role,
      'prize_amount_cents', v_ticket.prize_amount_cents,
      'proportional_prize_cents', v_prop_prize_cents,
      'confirmed_at', now()
    )
  );

  -- Notificar al propietario si quien confirma es un participante
  if v_user_id != v_ticket.owner_id then
    insert into public.notifications (
      user_id,
      ticket_id,
      type,
      title,
      body,
      action_url,
      metadata
    ) values (
      v_ticket.owner_id,
      v_ticket.id,
      'PRIZE_COLLECTED',
      'Cobro de premio confirmado',
      'Un participante ha confirmado la recepción de su parte (' ||
        to_char(v_prop_prize_cents / 100.0, 'FM999G999G999D00') || ' €) en el décimo Nº ' || v_ticket.number,
      '/billete/' || v_ticket.id,
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'share_id', v_share.id,
        'proportional_prize_cents', v_prop_prize_cents
      )
    );
  end if;

  -- Comprobar si TODOS los cotitulares con cuota > 0 han confirmado su cobro
  select count(*) into v_pending_count
  from public.ownership_shares
  where ticket_id = v_ticket.id and status = 'ACEPTADA' and percentage > 0 and prize_paid_confirmed = false;

  v_new_status := v_ticket.status;

  if v_pending_count = 0 then
    v_new_status := 'LIQUIDADO';
    update public.tickets
    set status = 'LIQUIDADO', updated_at = now()
    where id = v_ticket.id;

    insert into public.audit_events (ticket_id, actor_id, action, metadata)
    values (
      v_ticket.id,
      v_user_id,
      'DECIMO_LIQUIDADO',
      jsonb_build_object('liquidated_at', now(), 'total_prize_cents', v_ticket.prize_amount_cents)
    );

    -- Notificar a todos los cotitulares que el décimo ha sido liquidado
    insert into public.notifications (user_id, ticket_id, type, title, body, action_url)
    select user_id, v_ticket.id, 'TICKET_LIQUIDATED',
      'Décimo totalmente liquidado',
      'Todos los cotitulares del décimo Nº ' || v_ticket.number || ' han confirmado la recepción de su premio. ¡Décimo completado!',
      '/billete/' || v_ticket.id
    from public.ownership_shares
    where ticket_id = v_ticket.id and status = 'ACEPTADA' and percentage > 0;
  end if;

  return jsonb_build_object(
    'success', true,
    'share_id', p_share_id,
    'ticket_status', v_new_status,
    'fully_liquidated', (v_pending_count = 0)
  );
end;
$$;

-- 4. Actualización de reset_ticket_prize_simulation para limpiar marcas de solicitud de cobro
create or replace function public.reset_ticket_prize_simulation(
  p_ticket_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_ticket record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'Décimo no encontrado';
  end if;

  if v_ticket.owner_id != v_user_id then
    raise exception 'Solo el propietario del décimo puede restablecer la simulación';
  end if;

  -- Restablecer importe y estado a pendiente
  update public.tickets
  set
    prize_amount_cents = 0,
    status = 'PENDIENTE',
    last_checked_at = null,
    check_source = null,
    updated_at = now()
  where id = p_ticket_id;

  -- Restablecer confirmaciones de cobro y marcas de solicitud en las participaciones
  update public.ownership_shares
  set
    prize_paid_confirmed = false,
    prize_paid_confirmed_at = null,
    prize_payout_requested_at = null,
    prize_payout_requested_by = null
  where ticket_id = p_ticket_id;

  -- Registrar evento informativo en audit_events
  insert into public.audit_events (
    ticket_id,
    actor_id,
    action,
    metadata
  ) values (
    p_ticket_id,
    v_user_id,
    'SIMULACION_PREMIO_RESTABLECIDA',
    jsonb_build_object(
      'message', 'Simulación de premio restablecida',
      'previous_prize_cents', v_ticket.prize_amount_cents,
      'reset_at', now()
    )
  );

  return jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'prize_amount_cents', 0,
    'status', 'PENDIENTE',
    'message', 'Simulación de premio restablecida correctamente'
  );
end;
$$;

-- Permisos
grant execute on function public.request_prize_payout_confirmation(uuid) to authenticated;
grant execute on function public.confirm_prize_payout_received(uuid) to authenticated;
grant execute on function public.reset_ticket_prize_simulation(uuid) to authenticated;
