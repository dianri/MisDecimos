-- Migración: Firma Manuscrita en Pantalla (Acuerdo Privado Simple)
-- Fecha: 2026-11-28
-- Proyecto: xmdghpyfrblmtjtevtru

-- 1. Ampliar constraints de ticket_legal_events para soportar eventos de firma manuscrita
alter table public.ticket_legal_events
  drop constraint if exists ticket_legal_events_event_type_check;

alter table public.ticket_legal_events
  add constraint ticket_legal_events_event_type_check
  check (
    event_type in (
      'CUSTODY_CERTIFIED',
      'PARTICIPATION_ACCEPTED',
      'PARTICIPATION_SIGNED',
      'PARTICIPATION_RENOUNCED',
      'HANDWRITTEN_CUSTODY_SIGNED',
      'HANDWRITTEN_PARTICIPATION_SIGNED',
      'HANDWRITTEN_PARTICIPATION_RENOUNCED'
    )
  );

alter table public.ticket_legal_events
  drop constraint if exists ticket_legal_events_cert_method_check;

alter table public.ticket_legal_events
  add constraint ticket_legal_events_cert_method_check
  check (cert_method is null or cert_method in ('p12', 'autofirma', 'handwritten'));

-- 2. Tabla ticket_handwritten_signatures
create table if not exists public.ticket_handwritten_signatures (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  participation_id uuid null references public.ownership_shares(id) on delete set null,
  signer_user_id uuid not null references auth.users(id),
  signer_role text not null check (signer_role in ('custodian', 'participant')),
  full_name text not null,
  nif text not null,
  phone text not null,
  photo_path text null,
  photo_sha256 text null,
  signature_image_b64 text not null,
  signature_sha256 text not null,
  user_agent text null,
  verification_code text not null unique,
  signed_at timestamptz not null default now(),
  unique (ticket_id, signer_user_id, signer_role)
);

create index if not exists idx_ticket_handwritten_signatures_ticket
  on public.ticket_handwritten_signatures (ticket_id, signed_at asc);

alter table public.ticket_handwritten_signatures enable row level security;

drop policy if exists "ticket_handwritten_signatures_select" on public.ticket_handwritten_signatures;
create policy "ticket_handwritten_signatures_select"
on public.ticket_handwritten_signatures for select
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

drop policy if exists "ticket_handwritten_signatures_insert" on public.ticket_handwritten_signatures;
create policy "ticket_handwritten_signatures_insert"
on public.ticket_handwritten_signatures for insert
to authenticated
with check (
  signer_user_id = auth.uid()
  and exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and (
        (signer_role = 'custodian' and t.owner_id = auth.uid())
        or (
          signer_role = 'participant'
          and exists (
            select 1 from public.ownership_shares os
            where os.ticket_id = t.id
              and os.user_id = auth.uid()
              and os.role = 'PARTICIPANTE'
          )
        )
      )
  )
);

drop policy if exists "ticket_handwritten_signatures_delete" on public.ticket_handwritten_signatures;
create policy "ticket_handwritten_signatures_delete"
on public.ticket_handwritten_signatures for delete
to authenticated
using (signer_user_id = auth.uid());

-- 3. Trigger defensivo en tickets para firma manuscrita (retorno inmediato en registros normales)
create or replace function public.guard_handwritten_signed_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hw_id uuid;
  v_target_ticket_id uuid;
begin
  v_target_ticket_id := case when tg_op = 'DELETE' then old.id else new.id end;

  -- Retorno inmediato para todos los décimos normales de producción sin firma manuscrita
  select id into v_hw_id
  from public.ticket_handwritten_signatures
  where ticket_id = v_target_ticket_id
  limit 1;

  if v_hw_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  -- Si se modifica un campo crítico del décimo, limpiar firmas manuscritas obsoletas
  if (
    new.number is distinct from old.number
    or new.serie is distinct from old.serie
    or new.fraccion is distinct from old.fraccion
    or new.draw_date is distinct from old.draw_date
    or new.draw_name is distinct from old.draw_name
    or new.ticket_price is distinct from old.ticket_price
  ) then
    delete from public.ticket_handwritten_signatures where ticket_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_handwritten_signed_ticket on public.tickets;
create trigger trg_guard_handwritten_signed_ticket
before update or delete on public.tickets
for each row
execute function public.guard_handwritten_signed_ticket();

-- ROLLBACK:
-- drop trigger if exists trg_guard_handwritten_signed_ticket on public.tickets;
-- drop function if exists public.guard_handwritten_signed_ticket();
-- drop table if exists public.ticket_handwritten_signatures;
-- alter table public.ticket_legal_events drop constraint if exists ticket_legal_events_cert_method_check;
-- alter table public.ticket_legal_events add constraint ticket_legal_events_cert_method_check check (cert_method is null or cert_method in ('p12', 'autofirma'));
-- alter table public.ticket_legal_events drop constraint if exists ticket_legal_events_event_type_check;
-- alter table public.ticket_legal_events add constraint ticket_legal_events_event_type_check check (event_type in ('CUSTODY_CERTIFIED', 'PARTICIPATION_ACCEPTED', 'PARTICIPATION_SIGNED', 'PARTICIPATION_RENOUNCED'));
