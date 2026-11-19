-- ==============================================================================
-- Migración: 20261119045500_ticket_prize_simulation.sql
-- Descripción: Soporte para simulación de premio, desglose por cotitular en auditoría y función reset_ticket_prize_simulation
-- ==============================================================================

-- 1. Actualizar record_ticket_prize_check para incluir shares_breakdown en audit_events
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
  v_shares_breakdown jsonb;
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

  -- Calcular desglose de cuotas aceptadas activas
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', s.user_id,
        'role', s.role,
        'percentage', s.percentage,
        'proportional_prize_cents', round((p_prize_amount_cents::numeric) * (s.percentage / 100.0))
      )
    ),
    '[]'::jsonb
  )
  into v_shares_breakdown
  from public.ownership_shares s
  where s.ticket_id = p_ticket_id and s.status = 'ACEPTADA' and s.percentage > 0;

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
      'shares_breakdown', v_shares_breakdown,
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
        'ticket_id', p_ticket_id,
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
    'last_checked_at', now(),
    'shares_breakdown', v_shares_breakdown
  );
end;
$$;

-- 2. reset_ticket_prize_simulation
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

  -- Restablecer confirmaciones de cobro de participaciones si las hubiera
  update public.ownership_shares
  set
    prize_paid_confirmed = false,
    prize_paid_confirmed_at = null
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

-- Permisos de ejecución
grant execute on function public.record_ticket_prize_check(uuid, bigint, text, text) to authenticated;
grant execute on function public.reset_ticket_prize_simulation(uuid) to authenticated;
