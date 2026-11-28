-- Migración: Tabla temporal para relay @firma (stservlet)
-- Fecha: 2026-11-28
-- Proyecto: xmdghpyfrblmtjtevtru

create table if not exists public.autofirma_sessions (
  id text primary key check (id ~ '^[A-Za-z0-9]+$'),
  dat text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_autofirma_sessions_created_at
  on public.autofirma_sessions (created_at);

alter table public.autofirma_sessions enable row level security;

-- Limpieza automática de sesiones mayores a 10 minutos tras cada inserción
create or replace function public.cleanup_expired_autofirma_sessions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.autofirma_sessions
  where created_at < now() - interval '10 minutes';
  return new;
end;
$$;

drop trigger if exists trg_cleanup_expired_autofirma_sessions on public.autofirma_sessions;
create trigger trg_cleanup_expired_autofirma_sessions
after insert on public.autofirma_sessions
for each statement
execute function public.cleanup_expired_autofirma_sessions();

-- ROLLBACK:
-- drop trigger if exists trg_cleanup_expired_autofirma_sessions on public.autofirma_sessions;
-- drop function if exists public.cleanup_expired_autofirma_sessions();
-- drop table if exists public.autofirma_sessions;
