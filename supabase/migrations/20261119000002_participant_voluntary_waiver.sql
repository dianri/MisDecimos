-- 20261119000002_participant_voluntary_waiver.sql
-- Permite que un participante con cuota aceptada renuncie voluntariamente a ella,
-- reintegrando su porcentaje inmediatamente al propietario del décimo.

create or replace function public.renounce_own_participation(
  p_share_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_share record;
  v_ticket record;
  v_restored_percentage numeric(5,2);
  v_participant_name text;
begin
  -- 1. Verificar autenticación
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  -- 2. Bloquear y verificar la cuota del participante
  select * into v_share
  from public.ownership_shares
  where id = p_share_id
  for update;

  if not found then
    raise exception 'Participación no encontrada';
  end if;

  if v_share.user_id <> v_user_id then
    raise exception 'No tienes permisos para renunciar a esta participación';
  end if;

  if v_share.role <> 'PARTICIPANTE' then
    raise exception 'Solo un participante puede renunciar voluntariamente a su cuota';
  end if;

  if v_share.status <> 'ACEPTADA' or coalesce(v_share.percentage, 0) <= 0 then
    raise exception 'La participación no se encuentra en estado activa o no tiene porcentaje';
  end if;

  -- 3. Bloquear y verificar el décimo asociado
  select * into v_ticket
  from public.tickets
  where id = v_share.ticket_id
  for update;

  if not found then
    raise exception 'Décimo asociado no encontrado';
  end if;

  if v_ticket.status = 'LIQUIDADO' then
    raise exception 'No se puede renunciar a una participación de un décimo ya liquidado';
  end if;

  if v_ticket.status = 'VALIDADO' and coalesce(v_ticket.prize_amount_cents, 0) > 0 then
    raise exception 'No se puede renunciar a una participación de un décimo premiado pendiente de cobro';
  end if;

  v_restored_percentage := v_share.percentage;

  -- Obtener nombre del participante para la notificación y auditoría
  select coalesce(display_name, email, 'Un participante') into v_participant_name
  from public.profiles
  where id = v_user_id;

  -- 4. Reintegrar el porcentaje íntegro a la cuota del propietario
  update public.ownership_shares
  set percentage = percentage + v_restored_percentage,
      updated_at = now()
  where ticket_id = v_ticket.id
    and user_id = v_ticket.owner_id
    and role = 'PROPIETARIO';

  -- 5. Marcar la cuota del participante como RENUNCIADA con 0.00%
  update public.ownership_shares
  set status = 'RENUNCIADA',
      percentage = 0.00,
      waiver_requested = false,
      updated_at = now()
  where id = v_share.id;

  -- 6. Insertar registro inmutable en auditoría
  insert into public.audit_events (
    ticket_id,
    actor_id,
    target_user_id,
    action,
    percentage,
    metadata
  )
  values (
    v_ticket.id,
    v_user_id,
    v_ticket.owner_id,
    'RENUNCIA_VOLUNTARIA_PARTICIPANTE',
    v_restored_percentage,
    jsonb_build_object(
      'share_id', p_share_id,
      'restored_percentage', v_restored_percentage,
      'ticket_number', v_ticket.number,
      'participant_name', v_participant_name
    )
  );

  -- 7. Notificar al propietario y activar Web Push
  insert into public.notifications (
    user_id,
    ticket_id,
    type,
    title,
    body,
    action_url
  )
  values (
    v_ticket.owner_id,
    v_ticket.id,
    'PARTICIPANT_WAIVED',
    'Renuncia voluntaria de cuota',
    v_participant_name || ' ha renunciado a su participación del ' || trim(to_char(v_restored_percentage, '990.99')) || '% en el décimo #' || v_ticket.number || '. El porcentaje ha vuelto a tu custodia.',
    '/billetes/' || v_ticket.id
  );

  return true;
end;
$$;

grant execute on function public.renounce_own_participation(uuid) to authenticated;
