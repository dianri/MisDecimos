-- Migración: Configuración del Bucket de Almacenamiento de Avatares
-- Fecha: 2026-11-15
-- Proyecto: xmdghpyfrblmtjtevtru

-- 1. Crear el bucket 'avatars' en storage.buckets si no existe
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB límite
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 2. Políticas RLS en storage.objects para el bucket 'avatars'

-- Lectura pública: permite que todos los usuarios y cotitulares vean las fotos de perfil
drop policy if exists "avatars_public_select" on storage.objects;
create policy "avatars_public_select"
on storage.objects for select
using (bucket_id = 'avatars');

-- Inserción: solo usuarios autenticados y únicamente dentro de su propia carpeta (/user_id/*)
drop policy if exists "avatars_authenticated_insert" on storage.objects;
create policy "avatars_authenticated_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Actualización: solo el propietario de la carpeta puede actualizar su avatar
drop policy if exists "avatars_authenticated_update" on storage.objects;
create policy "avatars_authenticated_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Eliminación: solo el propietario de la carpeta puede borrar su avatar
drop policy if exists "avatars_authenticated_delete" on storage.objects;
create policy "avatars_authenticated_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
