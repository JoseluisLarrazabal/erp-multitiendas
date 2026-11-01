-- Una sola fórmula de Bs (P-08): BOB tal cual; USD round(monto * tipo_cambio, 2). Sin tipo de cambio: null, nunca 0.
-- security_invoker: la vista respeta la RLS de quien la consulta.

create view public.producto_precios_bs
with (security_invoker = true)
as
select
  pp.producto_id,
  pp.negocio_id,
  pp.lista,
  pp.monto,
  pp.moneda,
  tc.valor as tipo_cambio,
  case pp.moneda when 'BOB' then pp.monto else round(pp.monto * tc.valor, 2) end as monto_bs
from public.producto_precios pp
left join lateral (
  select t.valor
  from public.tipos_cambio t
  where t.negocio_id = pp.negocio_id
  order by t.vigente_desde desc
  limit 1
) tc on true;

revoke all on public.producto_precios_bs from anon, authenticated, public;
grant select on public.producto_precios_bs to authenticated;

-- Invoker: se apoya en la RLS de la vista. Sin precio, null.
create function public.precio_bs(p_producto_id uuid, p_lista text)
returns numeric
language sql
stable
set search_path = ''
as $$
  select monto_bs from public.producto_precios_bs where producto_id = p_producto_id and lista = p_lista
$$;

revoke all on function public.precio_bs(uuid, text) from public, anon, authenticated;
grant execute on function public.precio_bs(uuid, text) to authenticated;
