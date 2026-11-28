-- Migración: Blindaje de renuncia en BD para participaciones firmadas con certificado digital
-- Fecha: 2026-11-28
-- Proyecto: xmdghpyfrblmtjtevtru

create or replace function public.guard_signed_participation_renounce()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_signed_at timestamptz;
  v_has_signed_renounce boolean;
begin
  -- Retorno inmediato para cualquier actualización que no sea paso a RENUNCIADA
  if new.status is distinct from 'RENUNCIADA' or old.status = 'RENUNCIADA' then
    return new;
  end if;

  -- Comprobar si la participación tiene firma digital activa en ticket_legal_events
  select max(created_at) into v_last_signed_at
  from public.ticket_legal_events
  where ticket_id = new.ticket_id
    and event_type = 'PARTICIPATION_SIGNED'
    and (participation_id = new.id or actor_user_id = new.user_id)
    and signature_b64 is not null
    and cert_serial is not null;

  if v_last_signed_at is null then
    return new;
  end if;

  -- Si existe una renuncia posterior a la última firma sin nueva firma después, no bloquear
  if exists (
    select 1
    from public.ticket_legal_events
    where ticket_id = new.ticket_id
      and event_type = 'PARTICIPATION_RENOUNCED'
      and (participation_id = new.id or actor_user_id = new.user_id)
      and created_at > v_last_signed_at
      and signature_b64 is not null
      and cert_serial is not null
  ) then
    return new;
  end if;

  -- Exigir evento PARTICIPATION_RENOUNCED firmado electrónicamente
  select exists (
    select 1
    from public.ticket_legal_events
    where ticket_id = new.ticket_id
      and event_type = 'PARTICIPATION_RENOUNCED'
      and (participation_id = new.id or actor_user_id = new.user_id)
      and signature_b64 is not null
      and cert_serial is not null
  ) into v_has_signed_renounce;

  if not v_has_signed_renounce then
    raise exception 'Esta participación fue firmada con certificado digital y exige firma electrónica de renuncia.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_signed_participation_renounce on public.ownership_shares;
create trigger trg_guard_signed_participation_renounce
before update on public.ownership_shares
for each row
execute function public.guard_signed_participation_renounce();

-- ROLLBACK:
-- drop trigger if exists trg_guard_signed_participation_renounce on public.ownership_shares;
-- drop function if exists public.guard_signed_participation_renounce();
