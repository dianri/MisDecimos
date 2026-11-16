-- ============================================================================
-- Migración: 20261116000005_fix_rls_and_create_ticket.sql
-- Descripción: Corrección de recursión infinita en políticas RLS (tickets, ownership_shares,
--              pending_invites, audit_events) mediante funciones auxiliares SECURITY DEFINER,
--              y blindaje de la función RPC create_ticket.
-- ============================================================================

-- 1. Función SECURITY DEFINER para verificar si el usuario es el propietario del décimo
create or replace function public.is_ticket_owner(p_ticket_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.tickets
    where id = p_ticket_id
      and owner_id = auth.uid()
  );
$$;

-- 2. Función SECURITY DEFINER para verificar si el usuario tiene acceso al décimo
-- (propietario, cotitular con cuota o invitado involucrado)
create or replace function public.user_can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select (
    -- Es propietario
    exists (
      select 1 from public.tickets
      where id = p_ticket_id
        and owner_id = auth.uid()
    )
    or
    -- Es cotitular con participación registrada
    exists (
      select 1 from public.ownership_shares
      where ticket_id = p_ticket_id
        and user_id = auth.uid()
    )
    or
    -- Es creador o receptor de una invitación para el décimo
    exists (
      select 1 from public.pending_invites
      where ticket_id = p_ticket_id
        and (created_by = auth.uid() or accepted_by_user_id = auth.uid())
    )
  );
$$;

-- Otorgar permisos de ejecución a los roles autenticados
grant execute on function public.is_ticket_owner(uuid) to authenticated;
grant execute on function public.user_can_access_ticket(uuid) to authenticated;

-- ============================================================================
-- 3. REESTRUCTURACIÓN DE POLÍTICAS RLS SIN RECURSIÓN
-- ============================================================================

-- A) Tabla: public.tickets
drop policy if exists "tickets_select" on public.tickets;
drop policy if exists "tickets_insert" on public.tickets;
drop policy if exists "tickets_update" on public.tickets;
drop policy if exists "tickets_delete" on public.tickets;

create policy "tickets_select" on public.tickets
  for select to authenticated using (
    owner_id = auth.uid()
    or public.user_can_access_ticket(id)
  );

create policy "tickets_insert" on public.tickets
  for insert to authenticated with check (
    owner_id = auth.uid()
  );

create policy "tickets_update" on public.tickets
  for update to authenticated using (
    owner_id = auth.uid()
  ) with check (
    owner_id = auth.uid()
  );

create policy "tickets_delete" on public.tickets
  for delete to authenticated using (
    owner_id = auth.uid()
    and not exists (
      select 1 from public.ownership_shares os
      where os.ticket_id = tickets.id
        and os.user_id != auth.uid()
        and os.status = 'ACEPTADA'
    )
  );

-- B) Tabla: public.ownership_shares
drop policy if exists "ownership_shares_select" on public.ownership_shares;
drop policy if exists "ownership_shares_insert" on public.ownership_shares;
drop policy if exists "ownership_shares_update" on public.ownership_shares;
drop policy if exists "ownership_shares_delete" on public.ownership_shares;

create policy "ownership_shares_select" on public.ownership_shares
  for select to authenticated using (
    user_id = auth.uid()
    or public.user_can_access_ticket(ticket_id)
  );

create policy "ownership_shares_insert" on public.ownership_shares
  for insert to authenticated with check (
    user_id = auth.uid()
    or public.is_ticket_owner(ticket_id)
  );

create policy "ownership_shares_update" on public.ownership_shares
  for update to authenticated using (
    user_id = auth.uid()
    or public.is_ticket_owner(ticket_id)
  );

create policy "ownership_shares_delete" on public.ownership_shares
  for delete to authenticated using (
    public.is_ticket_owner(ticket_id)
  );

-- C) Tabla: public.pending_invites
drop policy if exists "pending_invites_select" on public.pending_invites;
drop policy if exists "pending_invites_insert" on public.pending_invites;
drop policy if exists "pending_invites_update" on public.pending_invites;
drop policy if exists "pending_invites_delete" on public.pending_invites;

create policy "pending_invites_select" on public.pending_invites
  for select to authenticated using (
    created_by = auth.uid()
    or accepted_by_user_id = auth.uid()
    or public.user_can_access_ticket(ticket_id)
  );

create policy "pending_invites_insert" on public.pending_invites
  for insert to authenticated with check (
    created_by = auth.uid()
    or public.is_ticket_owner(ticket_id)
  );

create policy "pending_invites_update" on public.pending_invites
  for update to authenticated using (
    created_by = auth.uid()
    or accepted_by_user_id = auth.uid()
    or public.is_ticket_owner(ticket_id)
  );

create policy "pending_invites_delete" on public.pending_invites
  for delete to authenticated using (
    created_by = auth.uid()
    or public.is_ticket_owner(ticket_id)
  );

-- D) Tabla: public.audit_events
drop policy if exists "audit_events_select" on public.audit_events;
drop policy if exists "audit_events_insert" on public.audit_events;

create policy "audit_events_select" on public.audit_events
  for select to authenticated using (
    public.user_can_access_ticket(ticket_id)
  );

create policy "audit_events_insert" on public.audit_events
  for insert to authenticated with check (
    actor_id = auth.uid()
  );

-- ============================================================================
-- 4. VERIFICACIÓN Y ASEGURAMIENTO DE LA RPC create_ticket
-- ============================================================================
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
    raise exception 'No autenticado: se requiere inicio de sesión para registrar un décimo';
  end if;

  -- Asegurar perfil
  insert into public.profiles (id, display_name, email)
  values (v_user_id, 'Usuario', coalesce(auth.jwt()->>'email', 'usuario@misdecimos.com'))
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

  -- Auditoría inmutable de creación
  insert into public.audit_events (ticket_id, actor_id, action, percentage, metadata)
  values (
    v_ticket_id, v_user_id, 'DECIMO_CREADO', 100.00,
    jsonb_build_object('origin', p_origin, 'number', p_number, 'draw_type', p_draw_type)
  );

  if p_origin = 'BARCODE_GS1' and p_barcode_raw is not null then
    insert into public.audit_events (ticket_id, actor_id, action, metadata)
    values (v_ticket_id, v_user_id, 'ESCANEO_CODIGO_BARRAS', jsonb_build_object('barcode_raw', p_barcode_raw));
  end if;

  -- Notificación
  insert into public.notifications (user_id, ticket_id, type, title, body, action_url)
  values (
    v_user_id, v_ticket_id, 'TICKET_CREATED',
    'Décimo registrado',
    'Has registrado el décimo número ' || p_number || ' para ' || p_draw_name,
    '/billetes/' || v_ticket_id
  );

  return v_ticket_id;
end;
$$;

grant execute on function public.create_ticket(varchar, varchar, varchar, text, text, date, numeric, text, uuid, text) to authenticated;
