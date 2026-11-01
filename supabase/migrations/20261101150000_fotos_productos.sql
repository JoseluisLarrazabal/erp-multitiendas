-- Fotos de producto: bucket privado `productos` (5 MB, JPEG/PNG/WebP; sin SVG, que ejecuta scripts).
-- Ruta <negocio_id>/<producto_id>.<ext>. Leer: cualquier miembro del negocio. Escribir: editar_productos.
-- Producción recibe el bucket por migración, no por config.toml.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Primer segmento de la ruta como uuid. null si no es uuid: el cast directo lanzaría error al evaluar
-- la policy sobre una ruta mal formada.
create function public.negocio_de_ruta_foto(p_ruta text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when split_part(p_ruta, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_ruta, '/', 1)::uuid end
$$;

revoke all on function public.negocio_de_ruta_foto(text) from public, anon, authenticated;
grant execute on function public.negocio_de_ruta_foto(text) to authenticated;

-- `case` y no `and`: Postgres no garantiza el orden de evaluación, y otros buckets no deben pasar por esta lógica.
create policy productos_fotos_select on storage.objects
  for select to authenticated
  using (case when bucket_id = 'productos'
    then public.negocio_de_ruta_foto(name) in (select public.mis_negocios()) else false end);

create policy productos_fotos_insert on storage.objects
  for insert to authenticated
  with check (case when bucket_id = 'productos'
    then public.tiene_permiso(public.negocio_de_ruta_foto(name), 'editar_productos') else false end);

create policy productos_fotos_update on storage.objects
  for update to authenticated
  using (case when bucket_id = 'productos'
    then public.tiene_permiso(public.negocio_de_ruta_foto(name), 'editar_productos') else false end)
  with check (case when bucket_id = 'productos'
    then public.tiene_permiso(public.negocio_de_ruta_foto(name), 'editar_productos') else false end);

create policy productos_fotos_delete on storage.objects
  for delete to authenticated
  using (case when bucket_id = 'productos'
    then public.tiene_permiso(public.negocio_de_ruta_foto(name), 'editar_productos') else false end);
