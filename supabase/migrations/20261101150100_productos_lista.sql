-- Lista de productos del panel con el estado de precio resuelto en base, para filtrar "sin precio" y paginar
-- en el servidor sin traer todo el catálogo. "Sin precio" = ninguna lista cargada. La lista principal es
-- contado (tienda, frial) o normal (lavandería). security_invoker: respeta la RLS de quien consulta.

create view public.productos_lista
with (security_invoker = true)
as
select
  p.id, p.negocio_id, p.codigo, p.codigo_barras, p.nombre, p.marca, p.modelo,
  p.categoria_id, c.nombre as categoria_nombre, p.tipo, p.unidad, p.activo, p.foto_path,
  exists (select 1 from public.producto_precios pp where pp.producto_id = p.id) as con_precio,
  pr.moneda as moneda_principal,
  pr.monto as monto_principal,
  pr.monto_bs as principal_bs
from public.productos p
left join public.categorias c on c.negocio_id = p.negocio_id and c.id = p.categoria_id
left join lateral (
  select b.moneda, b.monto, b.monto_bs
  from public.producto_precios_bs b
  where b.producto_id = p.id and b.lista in ('contado', 'normal')
  limit 1
) pr on true;

revoke all on public.productos_lista from anon, authenticated, public;
grant select on public.productos_lista to authenticated;
