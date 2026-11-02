-- inventario_lista: stock_negativo = alguna ubicación del producto tiene cantidad < 0 (RN-04: una venta sin conexión
-- puede dejar una ubicación en negativo aunque el total sume positivo). Columna nueva al final: create or replace.
create or replace view public.inventario_lista
with (security_invoker = true)
as
select
  p.id, p.negocio_id, p.codigo, p.codigo_barras, p.nombre, p.marca, p.unidad, p.controla_serie, p.activo,
  p.stock_minimo,
  coalesce(s.total, 0) as stock_total,
  (p.activo and p.stock_minimo is not null and coalesce(s.total, 0) < p.stock_minimo) as stock_bajo,
  coalesce(s.negativo, false) as stock_negativo
from public.productos p
left join lateral (
  select sum(st.cantidad) as total, bool_or(st.cantidad < 0) as negativo
  from public.stock st where st.producto_id = p.id
) s on true
where p.tipo <> 'servicio';
