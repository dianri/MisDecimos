-- Migración: Aislar trigger de renuncia estrictamente por participation_id (NEW.id)
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
  -- Retorno inmediato si la fila ya estaba renunciada o no pasa a renunciada
  if upper(coalesce(old.status, '')) in ('RENUNCIADA', 'RENOUNCED')
     or upper(coalesce(new.status, '')) not in ('RENUNCIADA', 'RENOUNCED') then
    return new;
  end if;

  -- Comprobar firma digital activa estrictamente para esta participación (participation_id = NEW.id)
  -- Ignora eventos históricos de otras participaciones o eventos huérfanos con participation_id IS NULL
  select max(created_at) into v_last_signed_at
  from public.ticket_legal_events
  where ticket_id = new.ticket_id
    and participation_id = new.id
    and event_type = 'PARTICIPATION_SIGNED'
    and signature_b64 is not null
    and cert_serial is not null;

  if v_last_signed_at is null then
    return new;
  end if;

  -- Si existe una renuncia firmada posterior a la última firma para esta misma participación, permitir
  select exists (
    select 1
    from public.ticket_legal_events
    where ticket_id = new.ticket_id
      and participation_id = new.id
      and event_type = 'PARTICIPATION_RENOUNCED'
      and created_at >= v_last_signed_at
      and signature_b64 is not null
      and cert_serial is not null
  ) into v_has_signed_renounce;

  if not v_has_signed_renounce then
    raise exception 'Esta participación (%) fue firmada con certificado digital y exige firma electrónica de renuncia.', new.id;
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
