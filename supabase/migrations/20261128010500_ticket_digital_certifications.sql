-- Migración: Certificación Digital y Custodia Legal de Décimos
-- Fecha: 2026-11-28
-- Proyecto: xmdghpyfrblmtjtevtru

-- 1. Bucket privado para fotografías de anverso certificadas
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-certifications',
  'ticket-certifications',
  false,
  5242880, -- 5MB límite
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "ticket_certifications_storage_select" on storage.objects;
create policy "ticket_certifications_storage_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ticket-certifications'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.tickets t
      where t.id::text = (storage.foldername(name))[2]
        and (
          t.owner_id = auth.uid()
          or exists (
            select 1 from public.ownership_shares os
            where os.ticket_id = t.id and os.user_id = auth.uid()
          )
        )
    )
  )
);

drop policy if exists "ticket_certifications_storage_insert" on storage.objects;
create policy "ticket_certifications_storage_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ticket-certifications'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "ticket_certifications_storage_delete" on storage.objects;
create policy "ticket_certifications_storage_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ticket-certifications'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Tabla ticket_certifications (1 a 1 con tickets)
create table if not exists public.ticket_certifications (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets(id) on delete cascade,
  custodian_user_id uuid not null references auth.users(id),
  status text not null default 'certified' check (status in ('certified')),
  photo_path text not null,
  photo_sha256 text not null,
  custodian_name text not null,
  custodian_nif text not null,
  cert_issuer text not null,
  cert_serial text not null,
  cert_method text not null check (cert_method in ('p12', 'autofirma')),
  signature_b64 text not null,
  payload_sha256 text not null,
  verification_code text not null unique,
  signed_at timestamptz not null default now()
);

alter table public.ticket_certifications enable row level security;

drop policy if exists "ticket_certifications_select" on public.ticket_certifications;
create policy "ticket_certifications_select"
on public.ticket_certifications for select
to authenticated
using (
  exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1 from public.ownership_shares os
          where os.ticket_id = t.id and os.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "ticket_certifications_insert" on public.ticket_certifications;
create policy "ticket_certifications_insert"
on public.ticket_certifications for insert
to authenticated
with check (
  custodian_user_id = auth.uid()
  and exists (
    select 1 from public.tickets t
    where t.id = ticket_id and t.owner_id = auth.uid()
  )
);

drop policy if exists "ticket_certifications_delete" on public.ticket_certifications;
create policy "ticket_certifications_delete"
on public.ticket_certifications for delete
to authenticated
using (
  custodian_user_id = auth.uid()
  and not exists (
    select 1 from public.ownership_shares os
    where os.ticket_id = ticket_id
      and os.role = 'PARTICIPANTE'
      and os.status = 'ACEPTADA'
  )
);

-- 3. Tabla inmutable ticket_legal_events (append-only)
create table if not exists public.ticket_legal_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  participation_id uuid null references public.ownership_shares(id) on delete set null,
  actor_user_id uuid not null references auth.users(id),
  event_type text not null check (
    event_type in (
      'CUSTODY_CERTIFIED',
      'PARTICIPATION_ACCEPTED',
      'PARTICIPATION_SIGNED',
      'PARTICIPATION_RENOUNCED'
    )
  ),
  actor_name text not null,
  actor_nif text null,
  cert_issuer text null,
  cert_serial text null,
  cert_method text null check (cert_method is null or cert_method in ('p12', 'autofirma')),
  signature_b64 text null,
  payload_sha256 text not null,
  share_percentage numeric null,
  share_amount numeric null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ticket_legal_events_ticket_created
  on public.ticket_legal_events (ticket_id, created_at asc);

alter table public.ticket_legal_events enable row level security;

drop policy if exists "ticket_legal_events_select" on public.ticket_legal_events;
create policy "ticket_legal_events_select"
on public.ticket_legal_events for select
to authenticated
using (
  exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1 from public.ownership_shares os
          where os.ticket_id = t.id and os.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "ticket_legal_events_insert" on public.ticket_legal_events;
create policy "ticket_legal_events_insert"
on public.ticket_legal_events for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1 from public.ownership_shares os
          where os.ticket_id = t.id and os.user_id = auth.uid()
        )
      )
  )
);

-- Trigger de inmutabilidad en ticket_legal_events (impide UPDATE y DELETE directo)
create or replace function public.prevent_ticket_legal_events_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'ticket_legal_events es inmutable: UPDATE no permitido';
  end if;

  -- Permitir únicamente el borrado en cascada cuando el décimo padre está siendo eliminado
  if tg_op = 'DELETE' then
    if pg_trigger_depth() = 0 or exists (
      select 1 from public.tickets t where t.id = old.ticket_id
    ) then
      raise exception 'ticket_legal_events es inmutable: DELETE no permitido';
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_ticket_legal_events_immutable on public.ticket_legal_events;
create trigger trg_ticket_legal_events_immutable
before update or delete on public.ticket_legal_events
for each row
execute function public.prevent_ticket_legal_events_mutation();

-- 4. Trigger defensivo de bloqueo en tickets certificados con participaciones aceptadas
create or replace function public.enforce_certified_ticket_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cert_id uuid;
  v_accepted_count integer;
  v_target_ticket_id uuid;
begin
  v_target_ticket_id := case when tg_op = 'DELETE' then old.id else new.id end;

  -- Primera línea defensiva: retorno inmediato para décimos normales de producción sin certificar
  select id into v_cert_id
  from public.ticket_certifications
  where ticket_id = v_target_ticket_id
  limit 1;

  if v_cert_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select count(*)::integer into v_accepted_count
  from public.ownership_shares
  where ticket_id = v_target_ticket_id
    and role = 'PARTICIPANTE'
    and status = 'ACEPTADA';

  if v_accepted_count >= 1 then
    if tg_op = 'DELETE' then
      raise exception 'Este décimo tiene custodia certificada y participaciones aceptadas; no puede eliminarse.';
    end if;

    if (
      new.number is distinct from old.number
      or new.serie is distinct from old.serie
      or new.fraccion is distinct from old.fraccion
      or new.draw_date is distinct from old.draw_date
      or new.draw_name is distinct from old.draw_name
      or new.ticket_price is distinct from old.ticket_price
    ) then
      raise exception 'Este décimo tiene custodia certificada y participaciones aceptadas; sus datos críticos son inmutables.';
    end if;

    return new;
  end if;

  -- Si accepted_participations_count == 0: permitir editar o borrar; si cambia un campo crítico, anular certificación previa
  if tg_op = 'DELETE' then
    return old;
  end if;

  if (
    new.number is distinct from old.number
    or new.serie is distinct from old.serie
    or new.fraccion is distinct from old.fraccion
    or new.draw_date is distinct from old.draw_date
    or new.draw_name is distinct from old.draw_name
    or new.ticket_price is distinct from old.ticket_price
  ) then
    delete from public.ticket_certifications where ticket_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_certified_ticket_lock on public.tickets;
create trigger trg_enforce_certified_ticket_lock
before update or delete on public.tickets
for each row
execute function public.enforce_certified_ticket_lock();

-- ROLLBACK:
-- drop trigger if exists trg_enforce_certified_ticket_lock on public.tickets;
-- drop function if exists public.enforce_certified_ticket_lock();
-- drop trigger if exists trg_ticket_legal_events_immutable on public.ticket_legal_events;
-- drop function if exists public.prevent_ticket_legal_events_mutation();
-- drop table if exists public.ticket_legal_events;
-- drop table if exists public.ticket_certifications;
-- drop policy if exists "ticket_certifications_storage_delete" on storage.objects;
-- drop policy if exists "ticket_certifications_storage_insert" on storage.objects;
-- drop policy if exists "ticket_certifications_storage_select" on storage.objects;
-- delete from storage.buckets where id = 'ticket-certifications';
