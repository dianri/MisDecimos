-- ============================================================================
-- Migración: 20261116000008_allow_cancel_invites_in_validated_tickets.sql
-- Descripción: Permitir la cancelación individual y masiva de invitaciones pendientes
--              en cualquier estado del décimo (PENDIENTE, VALIDADO, ARCHIVADO, salvo LIQUIDADO),
--              reintegrando inmediatamente la cuota a la bolsa del propietario.
-- ============================================================================

-- 1. Actualizar cancel_pending_invite
create or replace function public.cancel_pending_invite(
  p_invite_id uuid
)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_invite record;
  v_ticket record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado: inicie sesión para realizar esta operación';
  end if;

  select pi.*, t.owner_id as ticket_owner_id into v_invite
  from public.pending_invites pi
  join public.tickets t on t.id = pi.ticket_id
  where pi.id = p_invite_id
    and (pi.created_by = v_user_id or t.owner_id = v_user_id)
    and pi.status = 'PENDIENTE'
  for update;

  if not found then
    raise exception 'Invitación pendiente no encontrada o no pertenece al usuario';
  end if;

  -- Comprobar estado del décimo
  select * into v_ticket from public.tickets where id = v_invite.ticket_id;
  if v_ticket.status = 'LIQUIDADO' then
    raise exception 'No se pueden cancelar invitaciones de un décimo ya liquidado';
  end if;

  -- Marcar invitación como cancelada
  update public.pending_invites
  set status = 'CANCELADA', updated_at = now()
  where id = v_invite.id;

  -- Reintegrar porcentaje al propietario del décimo
  update public.ownership_shares
  set percentage = percentage + v_invite.percentage, updated_at = now()
  where ticket_id = v_invite.ticket_id and user_id = v_invite.ticket_owner_id and role = 'PROPIETARIO';

  -- Auditoría inmutable
  insert into public.audit_events (ticket_id, actor_id, action, percentage, metadata)
  values (
    v_invite.ticket_id, v_user_id, 'PARTICIPACION_CANCELADA', v_invite.percentage,
    jsonb_build_object('invite_id', p_invite_id, 'short_code', v_invite.short_code)
  );

  return true;
end;
$$;

-- 2. Función atómica para cancelar todas las invitaciones pendientes de un décimo
create or replace function public.cancel_all_pending_invites(
  p_ticket_id uuid
)
returns integer
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_count integer := 0;
  v_invite record;
  v_total_pct numeric := 0;
  v_ticket record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado: inicie sesión para realizar esta operación';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Décimo no encontrado';
  end if;

  if v_ticket.owner_id != v_user_id then
    raise exception 'Solo el propietario del décimo puede cancelar invitaciones pendientes';
  end if;

  if v_ticket.status = 'LIQUIDADO' then
    raise exception 'No se pueden cancelar invitaciones de un décimo ya liquidado';
  end if;

  for v_invite in
    select * from public.pending_invites
    where ticket_id = p_ticket_id and status = 'PENDIENTE'
    for update
  loop
    update public.pending_invites
    set status = 'CANCELADA', updated_at = now()
    where id = v_invite.id;

    v_total_pct := v_total_pct + v_invite.percentage;
    v_count := v_count + 1;

    insert into public.audit_events (ticket_id, actor_id, action, percentage, metadata)
    values (
      p_ticket_id, v_user_id, 'PARTICIPACION_CANCELADA', v_invite.percentage,
      jsonb_build_object('invite_id', v_invite.id, 'short_code', v_invite.short_code, 'bulk', true)
    );
  end loop;

  if v_total_pct > 0 then
    update public.ownership_shares
    set percentage = percentage + v_total_pct, updated_at = now()
    where ticket_id = p_ticket_id and user_id = v_user_id and role = 'PROPIETARIO';
  end if;

  return v_count;
end;
$$;

grant execute on function public.cancel_pending_invite(uuid) to authenticated;
grant execute on function public.cancel_all_pending_invites(uuid) to authenticated;
