-- Marcas distintas por negocio para el filtro del catálogo. Antes se leía la columna de todos los productos y PostgREST la
-- cortaba en max_rows (1000): las marcas de más allá de esas filas no aparecían. Aquí la base devuelve una fila por marca.
-- security_invoker: respeta la RLS de productos de quien consulta.
-- shortcut: si un negocio superara 1000 marcas distintas, max_rows las cortaría igual; paginar el filtro si ocurre.

create view public.marcas_productos
with (security_invoker = true)
as
select distinct negocio_id, marca
from public.productos
where marca is not null;

revoke all on public.marcas_productos from anon, authenticated, public;
grant select on public.marcas_productos to authenticated;
