-- Migración Inicial de MisDecimos
-- Fecha: 2026-11-15
-- Proyecto: xmdghpyfrblmtjtevtru

-- 1. Extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Tabla public.profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  phone text,
  avatar_url text,
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger para perfiles de nuevos usuarios
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, auth
as $$
begin
  insert into public.profiles (id, display_name, email, phone, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Usuario'),
    new.email,
    new.phone,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.profiles.email),
    phone = coalesce(excluded.phone, public.profiles.phone),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Tabla public.draw_templates
create table if not exists public.draw_templates (
  id uuid primary key default gen_random_uuid(),
  draw_type text not null check (draw_type in ('NAVIDAD', 'EL_NINO', 'JUEVES', 'SABADO', 'ESPECIAL')),
  year int not null,
  name text not null,
  default_price numeric(6,2) not null default 20.00,
  template_image_url text,
  overlay_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Semillas de plantillas de boletos
insert into public.draw_templates (id, draw_type, year, name, default_price, template_image_url, overlay_config, is_active)
values
  ('11111111-1111-1111-1111-111111112025'::uuid, 'NAVIDAD', 2025, 'Sorteo Extraordinario de Navidad 2025', 20.00, 'https://misdecimos.dianrie.com/templates/navidad-2025.webp', '{"number_box": {"x": 58, "y": 38, "w": 38, "h": 16}, "series_box": {"x": 60, "y": 58, "w": 16, "h": 8}, "fraction_box": {"x": 78, "y": 58, "w": 16, "h": 8}}'::jsonb, true),
  ('11111111-1111-1111-1111-111111112026'::uuid, 'NAVIDAD', 2026, 'Sorteo Extraordinario de Navidad 2026', 20.00, 'https://misdecimos.dianrie.com/templates/navidad-2026.webp', '{"number_box": {"x": 58, "y": 38, "w": 38, "h": 16}, "series_box": {"x": 60, "y": 58, "w": 16, "h": 8}, "fraction_box": {"x": 78, "y": 58, "w": 16, "h": 8}}'::jsonb, true),
  ('22222222-2222-2222-2222-222222222025'::uuid, 'EL_NINO', 2025, 'Sorteo Extraordinario de El Niño 2025', 20.00, 'https://misdecimos.dianrie.com/templates/nino-2025.webp', '{"number_box": {"x": 58, "y": 38, "w": 38, "h": 16}, "series_box": {"x": 60, "y": 58, "w": 16, "h": 8}, "fraction_box": {"x": 78, "y": 58, "w": 16, "h": 8}}'::jsonb, true),
  ('22222222-2222-2222-2222-222222222026'::uuid, 'EL_NINO', 2026, 'Sorteo Extraordinario de El Niño 2026', 20.00, 'https://misdecimos.dianrie.com/templates/nino-2026.webp', '{"number_box": {"x": 58, "y": 38, "w": 38, "h": 16}, "series_box": {"x": 60, "y": 58, "w": 16, "h": 8}, "fraction_box": {"x": 78, "y": 58, "w": 16, "h": 8}}'::jsonb, true)
on conflict (id) do nothing;

-- 4. Tabla public.tickets
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  number varchar(5) not null check (number ~ '^\d{5}$'),
  serie varchar(10),
  fraccion varchar(10),
  draw_type text not null,
  draw_name text not null,
  draw_date date not null,
  ticket_price numeric(6,2) not null default 20.00,
  barcode_raw text,
  template_id uuid references public.draw_templates(id) on delete set null,
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE', 'VALIDADO', 'ARCHIVADO', 'LIQUIDADO')),
  prize_amount_cents bigint not null default 0,
  last_checked_at timestamptz,
  check_source text,
  origin text not null default 'MANUAL' check (origin in ('BARCODE_GS1', 'MANUAL', 'OCR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Tabla public.ownership_shares
create table if not exists public.ownership_shares (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  percentage numeric(5,2) not null check (percentage >= 0 AND percentage <= 100),
  role text not null check (role in ('PROPIETARIO', 'PARTICIPANTE')),
  status text not null default 'ACEPTADA' check (status in ('ACEPTADA', 'RENUNCIADA')),
  waiver_requested boolean not null default false,
  waiver_requested_at timestamptz,
  prize_paid_confirmed boolean not null default false,
  prize_paid_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_ticket_user unique (ticket_id, user_id)
);

-- 6. Tabla public.pending_invites
create table if not exists public.pending_invites (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  label text,
  percentage numeric(5,2) not null check (percentage > 0 AND percentage <= 100),
  invite_token uuid not null default gen_random_uuid() unique,
  short_code varchar(6) not null,
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'CANCELADA')),
  accepted_by_user_id uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Tabla public.ticket_archive_hides
create table if not exists public.ticket_archive_hides (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

-- 8. Tabla public.audit_events
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  percentage numeric(5,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 9. Tabla public.notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 10. Tabla public.web_push_subscriptions
create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  platform text,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices de rendimiento
create index if not exists idx_tickets_owner_id on public.tickets(owner_id);
create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_ownership_shares_user_id on public.ownership_shares(user_id);
create index if not exists idx_ownership_shares_ticket_id on public.ownership_shares(ticket_id);
create index if not exists idx_pending_invites_short_code on public.pending_invites(short_code);
create index if not exists idx_pending_invites_token on public.pending_invites(invite_token);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, is_read);
create index if not exists idx_audit_ticket on public.audit_events(ticket_id, created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.draw_templates enable row level security;
alter table public.tickets enable row level security;
alter table public.ownership_shares enable row level security;
alter table public.pending_invites enable row level security;
alter table public.ticket_archive_hides enable row level security;
alter table public.audit_events enable row level security;
alter table public.notifications enable row level security;
alter table public.web_push_subscriptions enable row level security;

-- Profiles: lectura para autenticados, modificación solo perfil propio
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Draw Templates: lectura pública para autenticados
create policy "draw_templates_select" on public.draw_templates
  for select to authenticated using (is_active = true);

-- Tickets: ver si es propietario, cotitular o invitado
create policy "tickets_select" on public.tickets
  for select to authenticated using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.ownership_shares os
      where os.ticket_id = tickets.id and os.user_id = auth.uid()
    )
    or exists (
      select 1 from public.pending_invites pi
      where pi.ticket_id = tickets.id and (pi.created_by = auth.uid() or pi.accepted_by_user_id = auth.uid())
    )
  );

create policy "tickets_insert" on public.tickets
  for insert to authenticated with check (owner_id = auth.uid());

create policy "tickets_update" on public.tickets
  for update to authenticated using (
    owner_id = auth.uid()
  );

create policy "tickets_delete" on public.tickets
  for delete to authenticated using (
    owner_id = auth.uid()
    and not exists (
      select 1 from public.ownership_shares os
      where os.ticket_id = tickets.id and os.user_id != auth.uid() and os.status = 'ACEPTADA'
    )
  );

-- Ownership Shares
create policy "ownership_shares_select" on public.ownership_shares
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.tickets t where t.id = ownership_shares.ticket_id and t.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.ownership_shares os2 where os2.ticket_id = ownership_shares.ticket_id and os2.user_id = auth.uid()
    )
  );

create policy "ownership_shares_insert" on public.ownership_shares
  for insert to authenticated with check (user_id = auth.uid());

create policy "ownership_shares_update" on public.ownership_shares
  for update to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.tickets t where t.id = ownership_shares.ticket_id and t.owner_id = auth.uid()
    )
  );

-- Pending Invites
create policy "pending_invites_select" on public.pending_invites
  for select to authenticated using (
    created_by = auth.uid()
    or accepted_by_user_id = auth.uid()
    or exists (
      select 1 from public.tickets t where t.id = pending_invites.ticket_id and t.owner_id = auth.uid()
    )
  );

create policy "pending_invites_insert" on public.pending_invites
  for insert to authenticated with check (created_by = auth.uid());

create policy "pending_invites_update" on public.pending_invites
  for update to authenticated using (
    created_by = auth.uid() or accepted_by_user_id = auth.uid()
  );

-- Ticket Archive Hides: privado por usuario
create policy "archive_hides_all" on public.ticket_archive_hides
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Audit Events: visible para cotitulares y propietario
create policy "audit_events_select" on public.audit_events
  for select to authenticated using (
    exists (
      select 1 from public.tickets t where t.id = audit_events.ticket_id and t.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.ownership_shares os where os.ticket_id = audit_events.ticket_id and os.user_id = auth.uid()
    )
  );

create policy "audit_events_insert" on public.audit_events
  for insert to authenticated with check (actor_id = auth.uid());

-- Notifications: estrictamente para el usuario destinatario
create policy "notifications_select" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "notifications_update" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications_delete" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

create policy "notifications_insert" on public.notifications
  for insert to authenticated with check (true);

-- Web Push Subscriptions
create policy "push_subs_all" on public.web_push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- SUPABASE REALTIME
-- ============================================================================

do $$
begin
  alter publication supabase_realtime add table public.notifications;
  alter publication supabase_realtime add table public.ownership_shares;
  alter publication supabase_realtime add table public.pending_invites;
  alter publication supabase_realtime add table public.tickets;
exception
  when others then null;
end $$;

-- ============================================================================
-- FUNCIONES RPC TRANSACCIONALES (SECURITY DEFINER)
-- ============================================================================

-- 1. create_ticket
create or replace function public.create_ticket(
  p_number varchar(5),
  p_serie varchar(10) default null,
  p_fraccion varchar(10) default null,
  p_draw_type text default 'NAVIDAD',
  p_draw_name text default 'Sorteo Extraordinario de Navidad',
  p_draw_date date default current_date,
  p_ticket_price numeric default 20.00,
  p_barcode_raw text default null,
  p_template_id uuid default null,
  p_origin text default 'MANUAL'
)
returns uuid
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_ticket_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  -- Asegurar perfil
  insert into public.profiles (id, display_name, email)
  values (v_user_id, 'Usuario', auth.jwt()->>'email')
  on conflict (id) do nothing;

  -- Insertar décimo
  insert into public.tickets (
    owner_id, number, serie, fraccion, draw_type, draw_name, draw_date,
    ticket_price, barcode_raw, template_id, status, origin
  ) values (
    v_user_id, p_number, p_serie, p_fraccion, p_draw_type, p_draw_name, p_draw_date,
    p_ticket_price, p_barcode_raw, p_template_id, 'PENDIENTE', p_origin
  ) returning id into v_ticket_id;

  -- Cuota inicial 100% propietario
  insert into public.ownership_shares (
    ticket_id, user_id, percentage, role, status
  ) values (
    v_ticket_id, v_user_id, 100.00, 'PROPIETARIO', 'ACEPTADA'
  );

  -- Auditoría
  insert into public.audit_events (ticket_id, actor_id, action, percentage, metadata)
  values (
    v_ticket_id, v_user_id, 'DECIMO_CREADO', 100.00,
    jsonb_build_object('origin', p_origin, 'number', p_number)
  );

  if p_origin = 'BARCODE_GS1' then
    insert into public.audit_events (ticket_id, actor_id, action, metadata)
    values (v_ticket_id, v_user_id, 'ESCANEO_CODIGO_BARRAS', jsonb_build_object('barcode_raw', p_barcode_raw));
  end if;

  -- Notificación
  insert into public.notifications (user_id, ticket_id, type, title, body, action_url)
  values (
    v_user_id, v_ticket_id, 'TICKET_CREATED',
    'Décimo registrado',
    'Has registrado el décimo número ' || p_number || ' para ' || p_draw_name,
    '/billete/' || v_ticket_id
  );

  return v_ticket_id;
end;
$$;

-- 2. create_manual_participation
create or replace function public.create_manual_participation(
  p_ticket_id uuid,
  p_percentage numeric,
  p_label text default null
)
returns uuid
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_owner_share record;
  v_invite_id uuid;
  v_short_code varchar(6);
  v_exists boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if p_percentage <= 0 or p_percentage > 100 then
    raise exception 'Porcentaje inválido: debe ser mayor a 0 y menor o igual a 100';
  end if;

  -- Obtener cuota del propietario con bloqueo pesimista
  select * into v_owner_share
  from public.ownership_shares
  where ticket_id = p_ticket_id and user_id = v_user_id and role = 'PROPIETARIO'
  for update;

  if not found then
    raise exception 'Solo el propietario puede ceder participaciones de este décimo';
  end if;

  if v_owner_share.percentage < p_percentage then
    raise exception 'Porcentaje insuficiente disponible. Cuota actual: %', v_owner_share.percentage;
  end if;

  -- Generar short_code numérico único de 6 dígitos
  loop
    v_short_code := lpad(floor(random() * 900000 + 100000)::text, 6, '0');
    select exists (
      select 1 from public.pending_invites
      where short_code = v_short_code and status = 'PENDIENTE'
    ) into v_exists;
    exit when not v_exists;
  end loop;

  -- Descontar del propietario
  update public.ownership_shares
  set percentage = percentage - p_percentage, updated_at = now()
  where id = v_owner_share.id;

  -- Crear invitación pendiente
  insert into public.pending_invites (
    ticket_id, created_by, label, percentage, short_code, status
  ) values (
    p_ticket_id, v_user_id, p_label, p_percentage, v_short_code, 'PENDIENTE'
  ) returning id into v_invite_id;

  -- Auditoría
  insert into public.audit_events (ticket_id, actor_id, action, percentage, metadata)
  values (
    p_ticket_id, v_user_id, 'PARTICIPACION_CREADA', p_percentage,
    jsonb_build_object('invite_id', v_invite_id, 'short_code', v_short_code, 'label', p_label)
  );

  insert into public.audit_events (ticket_id, actor_id, action, percentage, metadata)
  values (
    p_ticket_id, v_user_id, 'INVITACION_ENVIADA', p_percentage,
    jsonb_build_object('invite_id', v_invite_id, 'short_code', v_short_code)
  );

  return v_invite_id;
end;
$$;

-- 3. create_equal_split_participations
create or replace function public.create_equal_split_participations(
  p_ticket_id uuid,
  p_parts_count int,
  p_owner_participates boolean default true
)
returns jsonb
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_owner_share record;
  v_cancelled_sum numeric(5,2) := 0;
  v_total_avail numeric(5,2);
  v_base_part numeric(5,2);
  v_owner_part numeric(5,2);
  v_invites_to_create int;
  v_i int;
  v_short_code varchar(6);
  v_exists boolean;
  v_created_codes jsonb := '[]'::jsonb;
  v_new_invite_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if p_parts_count < 2 or p_parts_count > 10 then
    raise exception 'El número de partes debe estar comprendido entre 2 y 10';
  end if;

  select * into v_owner_share
  from public.ownership_shares
  where ticket_id = p_ticket_id and user_id = v_user_id and role = 'PROPIETARIO'
  for update;

  if not found then
    raise exception 'Solo el propietario puede gestionar el reparto del décimo';
  end if;

  -- Cancelar invitaciones pendientes previas devolviendo su cuota
  select coalesce(sum(percentage), 0) into v_cancelled_sum
  from public.pending_invites
  where ticket_id = p_ticket_id and status = 'PENDIENTE';

  if v_cancelled_sum > 0 then
    update public.pending_invites
    set status = 'CANCELADA', updated_at = now()
    where ticket_id = p_ticket_id and status = 'PENDIENTE';
  end if;

  v_total_avail := v_owner_share.percentage + v_cancelled_sum;

  if v_total_avail <= 0 then
    raise exception 'No hay porcentaje disponible para repartir';
  end if;

  if p_owner_participates then
    v_base_part := round(v_total_avail / p_parts_count, 2);
    v_owner_part := v_total_avail - (v_base_part * (p_parts_count - 1));
    v_invites_to_create := p_parts_count - 1;

    update public.ownership_shares
    set percentage = v_owner_part, updated_at = now()
    where id = v_owner_share.id;
  else
    v_base_part := round(v_total_avail / p_parts_count, 2);
    v_owner_part := 0.00;
    v_invites_to_create := p_parts_count;

    update public.ownership_shares
    set percentage = 0.00, updated_at = now()
    where id = v_owner_share.id;
  end if;

  -- Crear las invitaciones pendientes
  for v_i in 1..v_invites_to_create loop
    loop
      v_short_code := lpad(floor(random() * 900000 + 100000)::text, 6, '0');
      select exists (
        select 1 from public.pending_invites
        where short_code = v_short_code and status = 'PENDIENTE'
      ) into v_exists;
      exit when not v_exists;
    end loop;

    insert into public.pending_invites (
      ticket_id, created_by, label, percentage, short_code, status
    ) values (
      p_ticket_id, v_user_id, 'Parte ' || (v_i + (case when p_owner_participates then 1 else 0 end)),
      v_base_part, v_short_code, 'PENDIENTE'
    ) returning id into v_new_invite_id;

    v_created_codes := v_created_codes || jsonb_build_object(
      'invite_id', v_new_invite_id,
      'short_code', v_short_code,
      'percentage', v_base_part
    );
  end loop;

  -- Auditoría
  insert into public.audit_events (ticket_id, actor_id, action, percentage, metadata)
  values (
    p_ticket_id, v_user_id, 'REPARTO_IGUALITARIO', v_total_avail,
    jsonb_build_object(
      'parts_count', p_parts_count,
      'owner_participates', p_owner_participates,
      'owner_percentage', v_owner_part,
      'each_invite_percentage', v_base_part,
      'invites_created', v_invites_to_create
    )
  );

  return jsonb_build_object(
    'ticket_id', p_ticket_id,
    'total_split', v_total_avail,
    'owner_percentage', v_owner_part,
    'parts_count', p_parts_count,
    'invites', v_created_codes
  );
end;
$$;

-- 4. cancel_pending_invite
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
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_invite
  from public.pending_invites
  where id = p_invite_id and created_by = v_user_id and status = 'PENDIENTE'
  for update;

  if not found then
    raise exception 'Invitación pendiente no encontrada o no pertenece al usuario';
  end if;

  -- Marcar invitación como cancelada
  update public.pending_invites
  set status = 'CANCELADA', updated_at = now()
  where id = v_invite.id;

  -- Reintegrar porcentaje al propietario
  update public.ownership_shares
  set percentage = percentage + v_invite.percentage, updated_at = now()
  where ticket_id = v_invite.ticket_id and user_id = v_user_id and role = 'PROPIETARIO';

  -- Auditoría
  insert into public.audit_events (ticket_id, actor_id, action, percentage, metadata)
  values (
    v_invite.ticket_id, v_user_id, 'PARTICIPACION_CANCELADA', v_invite.percentage,
    jsonb_build_object('invite_id', p_invite_id, 'short_code', v_invite.short_code)
  );

  return true;
end;
$$;

-- 5. accept_pending_invite
create or replace function public.accept_pending_invite(
  p_code_or_token text,
  p_confirm boolean default false
)
returns jsonb
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_invite record;
  v_ticket record;
  v_owner_profile record;
  v_existing_share record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  -- Buscar invitación
  select * into v_invite
  from public.pending_invites
  where (invite_token::text = p_code_or_token or short_code = p_code_or_token)
  limit 1;

  if not found then
    raise exception 'Código o token de invitación no válido';
  end if;

  if v_invite.status != 'PENDIENTE' then
    raise exception 'La invitación ya fue % y no puede aceptarse', v_invite.status;
  end if;

  -- Información del décimo
  select * into v_ticket from public.tickets where id = v_invite.ticket_id;
  select * into v_owner_profile from public.profiles where id = v_ticket.owner_id;

  -- Si es solo preview informativo
  if not p_confirm then
    return jsonb_build_object(
      'valid', true,
      'ticket_id', v_ticket.id,
      'number', v_ticket.number,
      'serie', v_ticket.serie,
      'fraccion', v_ticket.fraccion,
      'draw_name', v_ticket.draw_name,
      'draw_date', v_ticket.draw_date,
      'percentage', v_invite.percentage,
      'label', v_invite.label,
      'owner_name', coalesce(v_owner_profile.display_name, 'Propietario'),
      'short_code', v_invite.short_code
    );
  end if;

  -- Validaciones de confirmación
  if v_user_id = v_ticket.owner_id then
    raise exception 'El propietario no puede aceptar su propia invitación';
  end if;

  select * into v_existing_share
  from public.ownership_shares
  where ticket_id = v_ticket.id and user_id = v_user_id;

  if found and v_existing_share.status = 'ACEPTADA' then
    raise exception 'Ya posees una participación activa en este décimo';
  end if;

  -- Insertar o actualizar share del participante
  insert into public.ownership_shares (
    ticket_id, user_id, percentage, role, status
  ) values (
    v_ticket.id, v_user_id, v_invite.percentage, 'PARTICIPANTE', 'ACEPTADA'
  )
  on conflict (ticket_id, user_id) do update set
    percentage = excluded.percentage,
    role = 'PARTICIPANTE',
    status = 'ACEPTADA',
    waiver_requested = false,
    updated_at = now();

  -- Marcar invitación aceptada
  update public.pending_invites
  set status = 'ACEPTADA',
      accepted_by_user_id = v_user_id,
      accepted_at = now(),
      updated_at = now()
  where id = v_invite.id;

  -- Auditoría
  insert into public.audit_events (ticket_id, actor_id, target_user_id, action, percentage, metadata)
  values (
    v_ticket.id, v_user_id, v_ticket.owner_id, 'PARTICIPACION_ACEPTADA', v_invite.percentage,
    jsonb_build_object('invite_id', v_invite.id, 'short_code', v_invite.short_code)
  );

  -- Notificar al propietario
  insert into public.notifications (user_id, ticket_id, type, title, body, action_url)
  values (
    v_ticket.owner_id, v_ticket.id, 'INVITE_ACCEPTED',
    'Participación aceptada',
    'Un participante ha aceptado la participación del ' || v_invite.percentage || '% en tu décimo ' || v_ticket.number,
    '/billete/' || v_ticket.id
  );

  return jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket.id,
    'percentage', v_invite.percentage
  );
end;
$$;

-- 6. reject_pending_invite
create or replace function public.reject_pending_invite(
  p_code_or_token text
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
    raise exception 'No autenticado';
  end if;

  select * into v_invite
  from public.pending_invites
  where (invite_token::text = p_code_or_token or short_code = p_code_or_token)
    and status = 'PENDIENTE'
  for update;

  if not found then
    raise exception 'Invitación no encontrada o ya procesada';
  end if;

  select * into v_ticket from public.tickets where id = v_invite.ticket_id;

  -- Marcar invitación como rechazada
  update public.pending_invites
  set status = 'RECHAZADA', updated_at = now()
  where id = v_invite.id;

  -- Devolver porcentaje al propietario
  update public.ownership_shares
  set percentage = percentage + v_invite.percentage, updated_at = now()
  where ticket_id = v_invite.ticket_id and user_id = v_ticket.owner_id and role = 'PROPIETARIO';

  -- Auditoría
  insert into public.audit_events (ticket_id, actor_id, target_user_id, action, percentage, metadata)
  values (
    v_ticket.id, v_user_id, v_ticket.owner_id, 'PARTICIPACION_RECHAZADA', v_invite.percentage,
    jsonb_build_object('invite_id', v_invite.id, 'short_code', v_invite.short_code)
  );

  -- Notificar al propietario
  insert into public.notifications (user_id, ticket_id, type, title, body, action_url)
  values (
    v_ticket.owner_id, v_ticket.id, 'INVITE_REJECTED',
    'Invitación rechazada',
    'Una invitación del ' || v_invite.percentage || '% para el décimo ' || v_ticket.number || ' fue rechazada. El porcentaje ha regresado a tu saldo.',
    '/billete/' || v_ticket.id
  );

  return true;
end;
$$;

-- 7. request_share_waiver
create or replace function public.request_share_waiver(
  p_share_id uuid
)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_share record;
  v_ticket record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_share
  from public.ownership_shares
  where id = p_share_id and status = 'ACEPTADA' and role = 'PARTICIPANTE'
  for update;

  if not found then
    raise exception 'Participación aceptada no encontrada';
  end if;

  select * into v_ticket from public.tickets where id = v_share.ticket_id;

  if v_ticket.owner_id != v_user_id then
    raise exception 'Solo el propietario del décimo puede solicitar la renuncia de una participación';
  end if;

  -- Activar solicitud de renuncia
  update public.ownership_shares
  set waiver_requested = true, waiver_requested_at = now(), updated_at = now()
  where id = v_share.id;

  -- Auditoría
  insert into public.audit_events (ticket_id, actor_id, target_user_id, action, percentage, metadata)
  values (
    v_ticket.id, v_user_id, v_share.user_id, 'SOLICITUD_RENUNCIA_ENVIADA', v_share.percentage,
    jsonb_build_object('share_id', p_share_id)
  );

  -- Notificación interactiva al participante
  insert into public.notifications (user_id, ticket_id, type, title, body, action_url, metadata)
  values (
    v_share.user_id, v_ticket.id, 'WAIVER_REQUEST',
    'Solicitud de renuncia recibida',
    'El propietario del décimo ' || v_ticket.number || ' solicita que renuncies a tu participación del ' || v_share.percentage || '%.',
    '/billete/' || v_ticket.id,
    jsonb_build_object('share_id', p_share_id)
  );

  return true;
end;
$$;

-- 8. respond_share_waiver
create or replace function public.respond_share_waiver(
  p_share_id uuid,
  p_accept boolean
)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_share record;
  v_ticket record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_share
  from public.ownership_shares
  where id = p_share_id and user_id = v_user_id and waiver_requested = true
  for update;

  if not found then
    raise exception 'Solicitud de renuncia no encontrada o no autorizada';
  end if;

  select * into v_ticket from public.tickets where id = v_share.ticket_id;

  if p_accept then
    -- Reintegrar porcentaje al propietario
    update public.ownership_shares
    set percentage = percentage + v_share.percentage, updated_at = now()
    where ticket_id = v_ticket.id and user_id = v_ticket.owner_id and role = 'PROPIETARIO';

    -- Poner cuota del participante en RENUNCIADA y 0%
    update public.ownership_shares
    set status = 'RENUNCIADA', percentage = 0.00, waiver_requested = false, updated_at = now()
    where id = v_share.id;

    -- Auditoría
    insert into public.audit_events (ticket_id, actor_id, target_user_id, action, percentage, metadata)
    values (
      v_ticket.id, v_user_id, v_ticket.owner_id, 'SOLICITUD_RENUNCIA_ACEPTADA', v_share.percentage,
      jsonb_build_object('share_id', p_share_id)
    );

    -- Notificar al propietario
    insert into public.notifications (user_id, ticket_id, type, title, body, action_url)
    values (
      v_ticket.owner_id, v_ticket.id, 'WAIVER_ACCEPTED',
      'Renuncia aceptada',
      'El participante ha aceptado la renuncia a su participación de ' || v_share.percentage || '% en el décimo ' || v_ticket.number,
      '/billete/' || v_ticket.id
    );
  else
    -- Cancelar solicitud de renuncia
    update public.ownership_shares
    set waiver_requested = false, updated_at = now()
    where id = v_share.id;

    -- Auditoría
    insert into public.audit_events (ticket_id, actor_id, target_user_id, action, percentage, metadata)
    values (
      v_ticket.id, v_user_id, v_ticket.owner_id, 'SOLICITUD_RENUNCIA_RECHAZADA', v_share.percentage,
      jsonb_build_object('share_id', p_share_id)
    );

    -- Notificar al propietario
    insert into public.notifications (user_id, ticket_id, type, title, body, action_url)
    values (
      v_ticket.owner_id, v_ticket.id, 'WAIVER_REJECTED',
      'Renuncia rechazada',
      'El participante ha declinado renunciar a su participación en el décimo ' || v_ticket.number,
      '/billete/' || v_ticket.id
    );
  end if;

  return true;
end;
$$;

-- 9. confirm_prize_received
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

  -- Confirmar cobro
  update public.ownership_shares
  set prize_paid_confirmed = true, prize_paid_confirmed_at = now(), updated_at = now()
  where id = v_share.id;

  -- Auditoría
  insert into public.audit_events (ticket_id, actor_id, action, percentage, metadata)
  values (
    p_ticket_id, v_user_id, 'COBRO_PREMIO_CONFIRMADO', v_share.percentage,
    jsonb_build_object('share_id', v_share.id, 'prize_amount_cents', v_ticket.prize_amount_cents)
  );

  -- Notificar al propietario si quien confirma es participante
  if v_user_id != v_ticket.owner_id then
    insert into public.notifications (user_id, ticket_id, type, title, body, action_url)
    values (
      v_ticket.owner_id, p_ticket_id, 'PRIZE_COLLECTED',
      'Cobro de premio confirmado',
      'Un participante ha confirmado la recepción de su premio en el décimo ' || v_ticket.number,
      '/billete/' || p_ticket_id
    );
  end if;

  -- Comprobar si TODOS los participantes con cuota > 0 han confirmado
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
    values (p_ticket_id, v_user_id, 'DECIMO_LIQUIDADO', jsonb_build_object('liquidated_at', now()));

    -- Notificar a todos los cotitulares
    insert into public.notifications (user_id, ticket_id, type, title, body, action_url)
    select user_id, p_ticket_id, 'TICKET_LIQUIDATED',
      'Décimo totalmente liquidado',
      'Todos los participantes del décimo ' || v_ticket.number || ' han confirmado su premio. ¡Enhorabuena!',
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

-- 10. toggle_archive_ticket
create or replace function public.toggle_archive_ticket(
  p_ticket_id uuid,
  p_archive boolean
)
returns boolean
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

  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Décimo no encontrado';
  end if;

  if p_archive then
    insert into public.ticket_archive_hides (ticket_id, user_id, hidden_at)
    values (p_ticket_id, v_user_id, now())
    on conflict (ticket_id, user_id) do update set hidden_at = now();

    if v_ticket.owner_id = v_user_id then
      insert into public.audit_events (ticket_id, actor_id, action)
      values (p_ticket_id, v_user_id, 'DECIMO_ARCHIVADO');
    end if;
  else
    delete from public.ticket_archive_hides
    where ticket_id = p_ticket_id and user_id = v_user_id;

    if v_ticket.owner_id = v_user_id then
      insert into public.audit_events (ticket_id, actor_id, action)
      values (p_ticket_id, v_user_id, 'DECIMO_DESARCHIVADO');
    end if;
  end if;

  return true;
end;
$$;
