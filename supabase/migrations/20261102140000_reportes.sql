-- Fase 5, PR 3: reportes (RF-REP-01 a 05). Tres RPC de solo lectura con `ver_reportes` sobre el negocio; devuelven jsonb
-- { filas, totales } para no pasar por el max_rows de PostgREST. Más de 5.000 filas = ERP_LOTE_GRANDE (no se trunca).
-- Rango p_desde..p_hasta: fechas de La Paz, ambos días incluidos, hasta 366 días; si no, ERP_DATOS_INVALIDOS.
-- Costos (costo, ganancia, valor) solo con `ver_costos`; sin él salen null. venta_items.costo_unitario no tiene grant:
-- solo se lee aquí, dentro de security definer.

-- Las devoluciones se filtran por fecha (negocio_id, created_at); la venta ya tiene ventas_negocio_fecha_idx.
create index devoluciones_negocio_fecha_idx on public.devoluciones (negocio_id, created_at);

-- Decisiones de reporte_ventas:
-- * Fecha de una venta = recibida_en en La Paz (la misma que /panel/ventas), no creada_en_cliente: una venta hecha sin
--   conexión cuenta el día en que llegó al servidor.
-- * Lo cobrado por una línea (bruto) = total_linea - descuento_venta: el descuento de la venta ya está prorrateado por
--   línea en venta_items, no se vuelve a prorratear. Así la suma de las líneas es ventas.total.
-- * Una devolución resta en la fecha de la devolución (devoluciones.created_at), atribuida al vendedor y al producto de
--   la línea original, aunque la venta caiga fuera del rango. Su monto es devolucion_items.monto.
-- * cantidad y kg son netos de devoluciones. ganancia = neto - cantidad neta * costo_unitario (foto del costo); la parte
--   devuelta resta con el mismo costo. Las líneas de productos tipo 'servicio' tienen costo null por diseño
--   (registrar_venta): su costo es 0. Línea de producto/insumo con costo null: no entra ni al costo ni a la ganancia, y
--   se cuenta en lineas_sin_costo (por fila y en totales; solo líneas vendidas del rango). Fila sin ninguna línea con
--   costo: costo y ganancia null (no 0).
-- * kg = cantidad si el producto es de unidad 'kg'; si no, cantidad * peso_paquete_kg (0 sin peso).
create function public.reporte_ventas(p_negocio_id uuid, p_desde date, p_hasta date, p_agrupar text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_costos boolean;
  v_ini timestamptz;
  v_fin timestamptz;
  v_filas jsonb;
  v_tot jsonb;
  v_n integer;
begin
  if not public.tiene_permiso(p_negocio_id, 'ver_reportes') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 365
     or p_agrupar is null or p_agrupar not in ('dia', 'vendedor', 'producto', 'categoria', 'marca') then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_costos := public.tiene_permiso(p_negocio_id, 'ver_costos');
  v_ini := p_desde::timestamp at time zone 'America/La_Paz';
  v_fin := (p_hasta + 1)::timestamp at time zone 'America/La_Paz';

  with mov as materialized (
    select v.id as venta_id, v.recibida_en as ts, v.vendedor_id, vi.producto_id, vi.cantidad as cant,
           vi.total_linea - vi.descuento_venta as bruto, 0::numeric as dev, vi.costo_unitario as cu0
    from public.ventas v
    join public.venta_items vi on vi.venta_id = v.id
    where v.negocio_id = p_negocio_id and v.estado = 'completada' and v.recibida_en >= v_ini and v.recibida_en < v_fin
    union all
    select null, d.created_at, v.vendedor_id, vi.producto_id, -di.cantidad, 0::numeric, di.monto, vi.costo_unitario
    from public.devoluciones d
    join public.devolucion_items di on di.devolucion_id = d.id
    join public.venta_items vi on vi.id = di.venta_item_id
    join public.ventas v on v.id = vi.venta_id
    where d.negocio_id = p_negocio_id and d.created_at >= v_ini and d.created_at < v_fin
  ),
  base as (
    select m.*, case when p.tipo = 'servicio' then 0 else m.cu0 end as cu,
           p.codigo, p.nombre as producto, p.marca, p.categoria_id, c.nombre as categoria,
           coalesce(pe.nombre, 'Sin nombre') as vendedor,
           case when p.unidad = 'kg' then m.cant else m.cant * coalesce(p.peso_paquete_kg, 0) end as kg
    from mov m
    join public.productos p on p.id = m.producto_id
    left join public.categorias c on c.id = p.categoria_id
    left join public.perfiles pe on pe.id = m.vendedor_id
  ),
  k as (
    select x.clave, x.etiqueta, b.*
    from base b
    cross join lateral (values
      ('dia', (b.ts at time zone 'America/La_Paz')::date::text, (b.ts at time zone 'America/La_Paz')::date::text),
      ('vendedor', b.vendedor_id::text, b.vendedor),
      ('producto', b.producto_id::text, b.codigo || ' ' || b.producto),
      ('categoria', b.categoria_id::text, coalesce(b.categoria, 'Sin categoría')),
      ('marca', nullif(btrim(b.marca), ''), coalesce(nullif(btrim(b.marca), ''), 'Sin marca'))
    ) x (modo, clave, etiqueta)
    where x.modo = p_agrupar
  ),
  g as (
    select clave, etiqueta,
           count(distinct venta_id) as ventas, sum(cant) as cantidad, sum(kg) as kg,
           sum(bruto) as bruto, sum(dev) as devuelto, sum(bruto - dev) as neto,
           sum(cant * cu) filter (where cu is not null) as costo,
           sum(bruto - dev - cant * cu) filter (where cu is not null) as ganancia,
           count(*) filter (where venta_id is not null and cu is null) as lineas_sin_costo
    from k
    group by clave, etiqueta
  ),
  t as (
    select count(distinct venta_id) as ventas, coalesce(sum(cant), 0) as cantidad, coalesce(sum(kg), 0) as kg,
           coalesce(sum(bruto), 0) as bruto, coalesce(sum(dev), 0) as devuelto, coalesce(sum(bruto - dev), 0) as neto,
           coalesce(sum(cant * cu) filter (where cu is not null), 0) as costo,
           coalesce(sum(bruto - dev - cant * cu) filter (where cu is not null), 0) as ganancia,
           count(*) filter (where venta_id is not null and cu is null) as lineas_sin_costo
    from base
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'clave', g.clave, 'etiqueta', g.etiqueta, 'ventas', g.ventas, 'cantidad', g.cantidad, 'kg', g.kg,
        'bruto', g.bruto, 'devuelto', g.devuelto, 'neto', g.neto,
        'costo', case when v_costos then g.costo end, 'ganancia', case when v_costos then g.ganancia end,
        'lineas_sin_costo', g.lineas_sin_costo)
      order by case when p_agrupar = 'dia' then g.clave end, g.neto desc, g.etiqueta), '[]'::jsonb) from g),
    (select count(*) from g),
    (select jsonb_build_object('ventas', t.ventas, 'cantidad', t.cantidad, 'kg', t.kg, 'bruto', t.bruto,
        'devuelto', t.devuelto, 'neto', t.neto, 'lineas_sin_costo', t.lineas_sin_costo,
        'costo', case when v_costos then t.costo end, 'ganancia', case when v_costos then t.ganancia end) from t)
  into v_filas, v_n, v_tot;
  if v_n > 5000 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;
  return jsonb_build_object('filas', v_filas, 'totales', v_tot);
end;
$$;

-- Una fila por producto activo (producto o insumo). stock_bajo con la regla de productos_stock_bajo (stock < mínimo).
-- ultima_salida = último movimiento del kardex con cantidad < 0 que no sea traslado_salida (ventas, consumo, merma,
-- dañado y ajustes negativos cuentan; mover mercadería entre ubicaciones no). sin_movimiento: hay stock y no hay salida
-- o es anterior a N días. valor = suma por ubicación de greatest(cantidad, 0) * costo_promedio (costo null = 0; un
-- stock negativo en una ubicación no resta valor), solo con ver_costos. productos_sin_costo = productos con stock > 0
-- en alguna ubicación sin costo_promedio (también solo con ver_costos).
create function public.reporte_stock(p_negocio_id uuid, p_dias_sin_movimiento integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_costos boolean;
  v_filas jsonb;
  v_tot jsonb;
  v_n integer;
begin
  if not public.tiene_permiso(p_negocio_id, 'ver_reportes') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_dias_sin_movimiento is null or p_dias_sin_movimiento not between 1 and 3650 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_costos := public.tiene_permiso(p_negocio_id, 'ver_costos');

  with f as (
    select p.codigo, p.nombre, c.nombre as categoria, p.marca, p.unidad, p.stock_minimo,
           coalesce(s.cantidad, 0) as stock, s.valor, coalesce(s.sin_costo, false) as sin_costo, us.ultima_salida
    from public.productos p
    left join public.categorias c on c.id = p.categoria_id
    left join lateral (
      select sum(st.cantidad) as cantidad, sum(greatest(st.cantidad, 0) * coalesce(st.costo_promedio, 0)) as valor,
             bool_or(st.cantidad > 0 and st.costo_promedio is null) as sin_costo
      from public.stock st where st.producto_id = p.id
    ) s on true
    left join lateral (
      select m.created_at as ultima_salida
      from public.movimientos_inventario m
      where m.producto_id = p.id and m.cantidad < 0 and m.tipo <> 'traslado_salida'
      order by m.created_at desc limit 1
    ) us on true
    where p.negocio_id = p_negocio_id and p.activo and p.tipo <> 'servicio'
  ),
  r as (
    select f.*, f.stock_minimo is not null and f.stock < f.stock_minimo as stock_bajo,
           f.stock > 0 and (f.ultima_salida is null or f.ultima_salida < now() - make_interval(days => p_dias_sin_movimiento))
             as sin_movimiento
    from f
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'codigo', r.codigo, 'nombre', r.nombre, 'categoria', r.categoria, 'marca', r.marca, 'unidad', r.unidad,
        'stock', r.stock, 'stock_minimo', r.stock_minimo, 'stock_bajo', r.stock_bajo,
        'ultima_salida', r.ultima_salida, 'sin_movimiento', r.sin_movimiento,
        'valor', case when v_costos then coalesce(r.valor, 0) end) order by r.nombre, r.codigo), '[]'::jsonb) from r),
    (select count(*) from r),
    (select jsonb_build_object('productos', count(*), 'stock_bajo', count(*) filter (where r.stock_bajo),
        'sin_movimiento', count(*) filter (where r.sin_movimiento),
        'valor', case when v_costos then coalesce(sum(r.valor), 0) end,
        'productos_sin_costo', case when v_costos then count(*) filter (where r.sin_costo) end) from r)
  into v_filas, v_n, v_tot;
  if v_n > 5000 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;
  return jsonb_build_object('filas', v_filas, 'totales', v_tot);
end;
$$;

-- Una fila por sesión de caja abierta en el rango. Cada sesión sale de resumen_caja (que usa efectivo_esperado y
-- total_qr_sesion): no se repite ninguna fórmula. Por eso el permiso es ver_reportes (resumen_caja acepta también `caja`,
-- que aquí no basta). egresos = gastos + retiros; las devoluciones en efectivo van aparte. contado y diferencia son los
-- del cierre (null en sesiones abiertas). En totales, esperado/contado/diferencia suman solo las cerradas; las abiertas
-- van aparte (sesiones_abiertas, esperado_abiertas) para no mezclar poblaciones.
create function public.reporte_caja(p_negocio_id uuid, p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_filas jsonb;
  v_tot jsonb;
  v_n integer;
begin
  if not public.tiene_permiso(p_negocio_id, 'ver_reportes') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 365 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  with r as (
    select s.id, d.nombre as equipo, d.prefijo, coalesce(pe.nombre, 'Sin nombre') as cajero, s.abierta_en, s.cerrada_en, s.monto_inicial,
           (x ->> 'ventas_efectivo')::numeric as ventas_efectivo, (x ->> 'qr_neto')::numeric as qr_neto,
           (x ->> 'qr_pendiente')::numeric as qr_pendiente, (x ->> 'ingresos')::numeric as ingresos,
           (x ->> 'gastos')::numeric + (x ->> 'retiros')::numeric as egresos,
           (x ->> 'devoluciones_efectivo')::numeric as devoluciones_efectivo, (x ->> 'esperado')::numeric as esperado,
           s.monto_contado as contado, s.diferencia
    from public.caja_sesiones s
    join public.dispositivos d on d.id = s.dispositivo_id
    left join public.perfiles pe on pe.id = s.usuario_apertura
    cross join lateral public.resumen_caja(s.id) x
    where s.negocio_id = p_negocio_id
      and s.abierta_en >= p_desde::timestamp at time zone 'America/La_Paz'
      and s.abierta_en < (p_hasta + 1)::timestamp at time zone 'America/La_Paz'
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'sesion_id', r.id, 'equipo', r.equipo, 'prefijo', r.prefijo, 'cajero', r.cajero,
        'abierta_en', r.abierta_en, 'cerrada_en', r.cerrada_en, 'monto_inicial', r.monto_inicial,
        'ventas_efectivo', r.ventas_efectivo, 'ventas_qr', r.qr_neto, 'qr_pendiente', r.qr_pendiente,
        'ingresos', r.ingresos, 'egresos', r.egresos, 'devoluciones_efectivo', r.devoluciones_efectivo,
        'esperado', r.esperado, 'contado', r.contado, 'diferencia', r.diferencia)
      order by r.abierta_en, r.id), '[]'::jsonb) from r),
    (select count(*) from r),
    (select jsonb_build_object('sesiones', count(*), 'monto_inicial', coalesce(sum(r.monto_inicial), 0),
        'ventas_efectivo', coalesce(sum(r.ventas_efectivo), 0), 'ventas_qr', coalesce(sum(r.qr_neto), 0),
        'qr_pendiente', coalesce(sum(r.qr_pendiente), 0), 'ingresos', coalesce(sum(r.ingresos), 0),
        'egresos', coalesce(sum(r.egresos), 0), 'devoluciones_efectivo', coalesce(sum(r.devoluciones_efectivo), 0),
        'esperado', coalesce(sum(r.esperado) filter (where r.cerrada_en is not null), 0),
        'contado', coalesce(sum(r.contado) filter (where r.cerrada_en is not null), 0),
        'diferencia', coalesce(sum(r.diferencia) filter (where r.cerrada_en is not null), 0),
        'sesiones_abiertas', count(*) filter (where r.cerrada_en is null),
        'esperado_abiertas', coalesce(sum(r.esperado) filter (where r.cerrada_en is null), 0)) from r)
  into v_filas, v_n, v_tot;
  if v_n > 5000 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;
  return jsonb_build_object('filas', v_filas, 'totales', v_tot);
end;
$$;

revoke all on function public.reporte_ventas(uuid, date, date, text) from public, anon, authenticated;
revoke all on function public.reporte_stock(uuid, integer) from public, anon, authenticated;
revoke all on function public.reporte_caja(uuid, date, date) from public, anon, authenticated;
grant execute on function public.reporte_ventas(uuid, date, date, text) to authenticated;
grant execute on function public.reporte_stock(uuid, integer) to authenticated;
grant execute on function public.reporte_caja(uuid, date, date) to authenticated;
