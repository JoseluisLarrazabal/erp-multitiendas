-- Lista de stock del panel: una fila por producto que mueve stock, con el total de sus ubicaciones y si está bajo el
-- mínimo (misma regla que productos_stock_bajo). Permite buscar, filtrar "stock bajo" y paginar en el servidor sin
-- traer el catálogo entero (PostgREST corta en max_rows = 1000). Sin costos: stock.costo_promedio no se lee por columna.
-- security_invoker: respeta la RLS de quien consulta.

create view public.inventario_lista
with (security_invoker = true)
as
select
  p.id, p.negocio_id, p.codigo, p.codigo_barras, p.nombre, p.marca, p.unidad, p.controla_serie, p.activo,
  p.stock_minimo,
  coalesce(s.total, 0) as stock_total,
  (p.activo and p.stock_minimo is not null and coalesce(s.total, 0) < p.stock_minimo) as stock_bajo
from public.productos p
left join lateral (
  select sum(st.cantidad) as total from public.stock st where st.producto_id = p.id
) s on true
where p.tipo <> 'servicio';

revoke all on public.inventario_lista from anon, authenticated, public;
grant select on public.inventario_lista to authenticated;
