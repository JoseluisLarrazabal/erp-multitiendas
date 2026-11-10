-- M-12: búsquedas sin tildes. Campos calculados de PostgREST (`busqueda`) que la web usa en `.or()`/`.ilike`.
create extension if not exists unaccent with schema extensions;

create function public.sin_tildes(texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, texto) $$;

create function public.busqueda(r public.productos_lista) returns text
language sql stable set search_path = ''
as $$ select public.sin_tildes(concat_ws(' ', r.codigo, r.codigo_barras, r.nombre, r.marca, r.modelo)) $$;

create function public.busqueda(r public.inventario_lista) returns text
language sql stable set search_path = ''
as $$ select public.sin_tildes(concat_ws(' ', r.codigo, r.codigo_barras, r.nombre, r.marca)) $$;

create function public.busqueda(r public.clientes) returns text
language sql stable set search_path = ''
as $$ select public.sin_tildes(r.nombre) $$;

-- Sin busqueda(ordenes): authenticated solo tiene select por columna en ordenes (sin huella) y un campo calculado
-- recibe la fila entera, así que daría 42501. Las órdenes se siguen buscando con cliente_nombre tal cual.
revoke all on function public.sin_tildes(text) from public, anon;
revoke all on function public.busqueda(public.productos_lista) from public, anon;
revoke all on function public.busqueda(public.inventario_lista) from public, anon;
revoke all on function public.busqueda(public.clientes) from public, anon;
grant execute on function public.sin_tildes(text) to authenticated;
grant execute on function public.busqueda(public.productos_lista) to authenticated;
grant execute on function public.busqueda(public.inventario_lista) to authenticated;
grant execute on function public.busqueda(public.clientes) to authenticated;
