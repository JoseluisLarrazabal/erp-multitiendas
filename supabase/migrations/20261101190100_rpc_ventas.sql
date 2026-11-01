-- RPC de venta, anulación y devolución, y el efectivo esperado completo de la caja.
-- Errores: ERP_SIN_PERMISO, ERP_DATOS_INVALIDOS, ERP_OPERACION_REPETIDA, ERP_CAJA_CERRADA, ERP_EFECTIVO_INSUFICIENTE,
-- ERP_PRODUCTO_SIN_PRECIO, ERP_DESCUENTO_TOPE, ERP_NUMERO_DUPLICADO, ERP_VENTA_CON_DEVOLUCIONES (anular una venta que
-- ya tuvo devoluciones: se sigue devolviendo el resto), ERP_VENTA_ANULADA (devolver una venta no completada).
-- Idempotencia por UUID del cliente: mismo id y mismo payload (huella md5) = resultado original sin tocar nada; mismo
-- negocio con otro payload = ERP_OPERACION_REPETIDA; id de otro negocio = ERP_SIN_PERMISO (no confirma que exista).
-- Orden de locks, igual en las tres RPC: sesión de caja, dispositivo / venta, productos, stock (por producto), series.
-- Kardex: un movimiento por producto (suma de sus líneas), porque movimientos_operacion_uq es único por
-- (ref_id, producto, ubicación, tipo). Los servicios no mueven stock.

-- Privados (sin grant): validación de payload.
create function public.payload_claves(p jsonb, p_claves text[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  for k in select jsonb_object_keys(p) loop
    if k <> all (p_claves) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end loop;
end;
$$;

-- uuid como string. Ausente o null: null si p_nulo, si no inválido.
create function public.payload_uuid(p jsonb, p_clave text, p_nulo boolean)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p -> p_clave is null or jsonb_typeof(p -> p_clave) = 'null' then
    if p_nulo then
      return null;
    end if;
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if jsonb_typeof(p -> p_clave) <> 'string' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  return (p ->> p_clave)::uuid;
end;
$$;

-- Número JSON (nunca string) con a lo sumo p_dec decimales y >= 0. Ausente: p_defecto, o inválido si no hay.
create function public.payload_numero(p jsonb, p_clave text, p_dec integer, p_defecto numeric default null)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v numeric;
begin
  if p -> p_clave is null or jsonb_typeof(p -> p_clave) = 'null' then
    if p_defecto is null then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    return p_defecto;
  end if;
  if jsonb_typeof(p -> p_clave) <> 'number' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v := (p ->> p_clave)::numeric;
  if v < 0 or v <> round(v, p_dec) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  return v;
end;
$$;

-- texto JSON (nunca otro tipo), recortado, 1..p_max caracteres.
create function public.payload_texto(p jsonb, p_clave text, p_max integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if jsonb_typeof(p -> p_clave) is distinct from 'string' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v := btrim(p ->> p_clave);
  if v = '' or length(v) > p_max then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  return v;
end;
$$;

-- ISO 8601 con zona explícita (el cast pelado acepta infinity, epoch, now y zonas por nombre).
create function public.payload_timestamp(p jsonb, p_clave text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if jsonb_typeof(p -> p_clave) is distinct from 'string'
     or p ->> p_clave !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  return (p ->> p_clave)::timestamptz;
exception
  when datetime_field_overflow or invalid_datetime_format or invalid_time_zone_displacement_value then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- Resultado de una venta que ya existe con ese id.
create function public.resolver_venta_existente(p_venta public.ventas, p_negocio_id uuid, p_huella text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_venta.negocio_id <> p_negocio_id then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_venta.huella <> p_huella then
    raise exception 'ERP_OPERACION_REPETIDA';
  end if;
  return jsonb_build_object('id', p_venta.id, 'numero', p_venta.numero, 'total', p_venta.total);
end;
$$;

-- Privado: crea las filas de stock que falten y las bloquea en orden de producto.
create function public.bloquear_stock(p_negocio_id uuid, p_ubicacion_id uuid, p_producto_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_producto_ids is null or cardinality(p_producto_ids) = 0 then
    return;
  end if;
  insert into public.stock (negocio_id, producto_id, ubicacion_id, cantidad)
  select p_negocio_id, x, p_ubicacion_id, 0 from (select distinct x from unnest(p_producto_ids) x order by x) s
  on conflict do nothing;
  perform 1 from public.stock
  where ubicacion_id = p_ubicacion_id and producto_id = any (p_producto_ids)
  order by producto_id for update;
end;
$$;

-- Efectivo que debería haber en caja: inicial + ventas completadas en efectivo + ingresos - gastos - retiros
-- - devoluciones en efectivo. QR no entra. Privado (sin grant); invoker: lo llaman las RPC security definer.
create or replace function public.efectivo_esperado(p_sesion_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select s.monto_inicial
    + coalesce((select sum(case m.tipo when 'ingreso' then m.monto else -m.monto end)
                from public.caja_movimientos m where m.sesion_id = s.id), 0)
    + coalesce((select sum(vp.monto) from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
                where v.caja_sesion_id = s.id and v.estado = 'completada' and vp.medio = 'efectivo'), 0)
    - coalesce((select sum(d.monto_efectivo) from public.devoluciones d
                where d.caja_sesion_id = s.id), 0)
  from public.caja_sesiones s where s.id = p_sesion_id
$$;

-- QR neto de la sesión: cobrado en ventas completadas menos devuelto por QR en la sesión. Puede ser negativo (devolución
-- de una venta de otra sesión). Privado.
create function public.total_qr_sesion(p_sesion_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce((select sum(vp.monto) from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
                   where v.caja_sesion_id = p_sesion_id and v.estado = 'completada' and vp.medio = 'qr'), 0)
    - coalesce((select sum(d.monto - d.monto_efectivo) from public.devoluciones d
                where d.caja_sesion_id = p_sesion_id), 0)
$$;

-- Mismo contrato y firma que en 20261101180100, más total_qr (también en el reenvío).
create or replace function public.cerrar_caja(p_sesion_id uuid, p_monto_contado numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesion public.caja_sesiones;
  v_esperado numeric;
begin
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id;
  if not found or not public.tiene_permiso(v_sesion.negocio_id, 'caja') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_monto_contado is null or p_monto_contado = 'NaN' or p_monto_contado < 0
     or p_monto_contado <> round(p_monto_contado, 2) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  -- for update: espera a las ventas en curso (for share) y a los movimientos.
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id for update;
  if v_sesion.cerrada_en is not null then
    if v_sesion.monto_contado = p_monto_contado then
      return jsonb_build_object('monto_esperado', v_sesion.monto_esperado, 'diferencia', v_sesion.diferencia,
        'total_qr', public.total_qr_sesion(p_sesion_id));
    end if;
    raise exception 'ERP_CAJA_CERRADA';
  end if;

  v_esperado := public.efectivo_esperado(p_sesion_id);
  update public.caja_sesiones
  set cerrada_en = clock_timestamp(), usuario_cierre = (select auth.uid()), monto_contado = p_monto_contado,
      monto_esperado = v_esperado, diferencia = p_monto_contado - v_esperado
  where id = p_sesion_id;
  return jsonb_build_object('monto_esperado', v_esperado, 'diferencia', p_monto_contado - v_esperado,
    'total_qr', public.total_qr_sesion(p_sesion_id));
exception
  when numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- registrar_venta(p_venta): {id, dispositivo_id, caja_sesion_id, numero, cliente_id?, creada_en_cliente, descuento?,
-- total, items: [{producto_id, lista, cantidad, precio_unitario, descuento?, serie_id?}],
-- pagos: [{medio, monto, verificado?}]}. Devuelve {id, numero, total}.
create function public.registrar_venta(p_venta jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_dispositivo_id uuid;
  v_caja_id uuid;
  v_numero text;
  v_cliente_id uuid;
  v_creada timestamptz;
  v_desc_venta numeric;
  v_total numeric;
  v_items jsonb;
  v_pagos jsonb;
  v_disp public.dispositivos;
  v_negocio public.negocios;
  v_existente public.ventas;
  v_sesion public.caja_sesiones;
  v_tc numeric;
  v_seq integer;
  v_huella text := md5(p_venta::text);
  v_e jsonb;
  v_ord bigint;
  v_producto public.productos;
  v_lineas jsonb := '[]';
  v_serie_ids uuid[] := '{}';
  v_stock_ids uuid[] := '{}';
  v_cant numeric;
  v_precio numeric;
  v_desc numeric;
  v_lista text;
  v_srv numeric;
  v_min numeric;
  v_piso numeric;
  v_bruto numeric;
  v_total_linea numeric;
  v_subtotal numeric := 0;
  v_base numeric := 0;
  v_sum_lineas numeric := 0;
  v_desc_total numeric := 0;
  v_pide_descuento boolean := false;
  v_suma_pagos numeric := 0;
  v_medio text;
  v_costo numeric;
  v_cum numeric := 0;
  v_prev_asig numeric := 0;
  v_asig numeric;
  v_constraint text;
  v_serie_id uuid;
begin
  -- Forma del payload (sin tocar la base)
  perform public.payload_claves(p_venta, array['id', 'dispositivo_id', 'caja_sesion_id', 'numero', 'cliente_id',
    'creada_en_cliente', 'descuento', 'total', 'items', 'pagos']);
  v_id := public.payload_uuid(p_venta, 'id', false);
  v_dispositivo_id := public.payload_uuid(p_venta, 'dispositivo_id', false);
  v_caja_id := public.payload_uuid(p_venta, 'caja_sesion_id', false);
  v_cliente_id := public.payload_uuid(p_venta, 'cliente_id', true);
  v_numero := public.payload_texto(p_venta, 'numero', 20);
  v_creada := public.payload_timestamp(p_venta, 'creada_en_cliente');
  v_desc_venta := public.payload_numero(p_venta, 'descuento', 2, 0);
  v_total := public.payload_numero(p_venta, 'total', 2);
  v_items := p_venta -> 'items';
  v_pagos := p_venta -> 'pagos';
  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) not between 1 and 200
     or jsonb_typeof(v_pagos) is distinct from 'array' or jsonb_array_length(v_pagos) not between 1 and 10 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  for v_e in select e from jsonb_array_elements(v_items) e loop
    perform public.payload_claves(v_e, array['producto_id', 'lista', 'cantidad', 'precio_unitario', 'descuento', 'serie_id']);
    perform public.payload_uuid(v_e, 'producto_id', false);
    perform public.payload_uuid(v_e, 'serie_id', true);
    perform public.payload_numero(v_e, 'cantidad', 3);
    perform public.payload_numero(v_e, 'precio_unitario', 2);
    perform public.payload_numero(v_e, 'descuento', 2, 0);
    if jsonb_typeof(v_e -> 'lista') is distinct from 'string' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end loop;
  for v_e in select e from jsonb_array_elements(v_pagos) e loop
    perform public.payload_claves(v_e, array['medio', 'monto', 'verificado']);
    perform public.payload_numero(v_e, 'monto', 2);
    if jsonb_typeof(v_e -> 'medio') is distinct from 'string' or v_e ->> 'medio' not in ('efectivo', 'qr')
       or (v_e -> 'verificado' is not null and jsonb_typeof(v_e -> 'verificado') not in ('boolean', 'null'))
       or (v_e ->> 'medio' = 'qr' and v_e -> 'verificado' is distinct from 'true'::jsonb) then -- QR: confirmado en línea; pendiente es de offline (fase 3)
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end loop;

  -- Equipo y permiso
  select * into v_disp from public.dispositivos where id = v_dispositivo_id;
  if not found or not public.tiene_permiso(v_disp.negocio_id, 'vender') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_numero !~ '^[A-Z][0-9]{1,2}-[0-9]{6}$' or left(v_numero, length(v_disp.prefijo) + 1) <> v_disp.prefijo || '-' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_seq := right(v_numero, 6)::integer;

  -- Reenvío: devuelve lo original aunque la caja ya haya cerrado
  select * into v_existente from public.ventas where id = v_id;
  if found then
    return public.resolver_venta_existente(v_existente, v_disp.negocio_id, v_huella);
  end if;

  -- Locks: sesión (for share: deja esperando al cierre); el update del equipo serializa las ventas de ese equipo
  select * into v_sesion from public.caja_sesiones
  where id = v_caja_id and negocio_id = v_disp.negocio_id and dispositivo_id = v_dispositivo_id and cerrada_en is null
  for share;
  if not found then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  -- Tope de salto: un número alto por error dejaría al equipo sin numeración (ultimo_numero solo sube).
  update public.dispositivos set ultimo_numero = greatest(ultimo_numero, v_seq)
  where id = v_dispositivo_id and v_seq <= ultimo_numero + 1000;
  if not found then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  -- Otra llamada con el mismo id pudo ganar mientras esperábamos el lock del equipo.
  select * into v_existente from public.ventas where id = v_id;
  if found then
    return public.resolver_venta_existente(v_existente, v_disp.negocio_id, v_huella);
  end if;

  select * into v_negocio from public.negocios where id = v_disp.negocio_id;
  if v_negocio.tipo = 'lavanderia' and v_cliente_id is null then -- RF-VEN-04
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_cliente_id is not null
     and not exists (select 1 from public.clientes where id = v_cliente_id and negocio_id = v_disp.negocio_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  select valor into v_tc from public.tipos_cambio where negocio_id = v_disp.negocio_id order by vigente_desde desc limit 1;

  -- Líneas, ordenadas por producto (mismo orden de bloqueo que trasladar_stock)
  for v_e, v_ord in
    select t.e, t.ord from jsonb_array_elements(v_items) with ordinality t (e, ord)
    order by t.e ->> 'producto_id', t.ord
  loop
    v_lista := v_e ->> 'lista';
    if v_lista not in ('contado', 'mayorista', 'minimo', 'normal', 'express') then
      raise exception 'ERP_DATOS_INVALIDOS'; -- incluye 'credito': no se acepta en esta fase
    end if;
    select * into v_producto from public.productos
    where id = (v_e ->> 'producto_id')::uuid and negocio_id = v_disp.negocio_id and activo for share;
    if not found or (v_producto.tipo = 'servicio' and v_negocio.tipo <> 'lavanderia') then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_cant := (v_e ->> 'cantidad')::numeric;
    v_precio := (v_e ->> 'precio_unitario')::numeric;
    v_desc := coalesce((v_e ->> 'descuento')::numeric, 0);
    if v_cant <= 0 or v_precio <= 0 or ((v_producto.unidad = 'unidad' or v_producto.controla_serie) and v_cant <> trunc(v_cant)) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_serie_id := nullif(v_e ->> 'serie_id', '')::uuid;
    if v_producto.controla_serie then
      if v_serie_id is null or v_cant <> 1 or v_serie_id = any (v_serie_ids) then
        raise exception 'ERP_DATOS_INVALIDOS';
      end if;
      v_serie_ids := v_serie_ids || v_serie_id;
    elsif v_serie_id is not null then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;

    v_srv := public.precio_bs(v_producto.id, v_lista);
    if v_srv is null or v_srv <= 0 then
      raise exception 'ERP_PRODUCTO_SIN_PRECIO';
    end if;
    -- Piso de la línea: el menor entre el mínimo y la lista elegida, para no castigar una lista publicada bajo el
    -- mínimo. Entre el piso y la lista se negocia sin permiso; bajo el piso exige `descontar` y la brecha cuenta como
    -- descuento y como base del tope (bajar el precio no achica la base).
    v_min := public.precio_bs(v_producto.id, 'minimo');
    v_bruto := round(v_cant * v_precio, 2);
    v_piso := round(v_cant * least(v_min, v_srv), 2);
    if v_desc > 0 or v_precio < least(v_min, v_srv) then
      v_pide_descuento := true;
    end if;
    v_total_linea := v_bruto - v_desc;
    if v_total_linea < 0 then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_subtotal := v_subtotal + v_bruto;
    v_base := v_base + greatest(v_bruto, v_piso);
    v_sum_lineas := v_sum_lineas + v_total_linea;
    v_desc_total := v_desc_total + v_desc + greatest(v_piso - v_bruto, 0);
    if v_producto.tipo <> 'servicio' then
      v_stock_ids := v_stock_ids || v_producto.id;
    end if;
    v_lineas := v_lineas || jsonb_build_object('linea', v_ord, 'producto_id', v_producto.id, 'serie_id', v_serie_id,
      'lista', v_lista, 'cantidad', v_cant, 'precio', v_precio, 'descuento', v_desc, 'total_linea', v_total_linea,
      'precio_lista', v_srv, 'servicio', v_producto.tipo = 'servicio');
  end loop;

  -- Descuento (RF-VEN-03) y aritmética (DB-11)
  v_desc_total := v_desc_total + v_desc_venta;
  if v_desc_venta > 0 then
    v_pide_descuento := true;
  end if;
  if v_pide_descuento and not public.tiene_permiso(v_disp.negocio_id, 'descontar') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_desc_total > v_base * v_negocio.tope_descuento / 100 then
    raise exception 'ERP_DESCUENTO_TOPE';
  end if;
  if v_sum_lineas - v_desc_venta <= 0 or v_sum_lineas - v_desc_venta <> v_total then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  for v_e in select e from jsonb_array_elements(v_pagos) e loop
    v_suma_pagos := v_suma_pagos + (v_e ->> 'monto')::numeric;
  end loop;
  if v_suma_pagos <> v_total then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  insert into public.ventas (id, negocio_id, ubicacion_id, dispositivo_id, caja_sesion_id, numero, vendedor_id, enviada_por,
    cliente_id, origen, creada_en_cliente, subtotal, descuento, total, tipo_cambio, huella)
  values (v_id, v_disp.negocio_id, v_disp.ubicacion_id, v_dispositivo_id, v_caja_id, v_numero, v_uid, v_uid,
    v_cliente_id, 'online', v_creada, v_subtotal, v_desc_venta, v_total, v_tc, v_huella)
  on conflict (id) do nothing;
  if not found then
    select * into v_existente from public.ventas where id = v_id;
    return public.resolver_venta_existente(v_existente, v_disp.negocio_id, v_huella);
  end if;

  -- Stock: filas creadas y bloqueadas en orden de producto; el costo es el promedio de la ubicación del equipo (DB-08)
  perform public.bloquear_stock(v_disp.negocio_id, v_disp.ubicacion_id, v_stock_ids);

  for v_e in select e from jsonb_array_elements(v_lineas) e loop
    v_costo := null;
    if not (v_e ->> 'servicio')::boolean then
      select costo_promedio into v_costo from public.stock
      where producto_id = (v_e ->> 'producto_id')::uuid and ubicacion_id = v_disp.ubicacion_id;
    end if;
    -- Descuento de la venta repartido por acumulado redondeado: suma exacta, nunca negativo
    v_cum := v_cum + (v_e ->> 'total_linea')::numeric;
    v_asig := round(v_desc_venta * v_cum / v_sum_lineas, 2);
    insert into public.venta_items (negocio_id, venta_id, linea, producto_id, serie_id, lista, cantidad, precio_unitario,
      precio_lista_servidor, descuento, total_linea, descuento_venta, costo_unitario)
    values (v_disp.negocio_id, v_id, (v_e ->> 'linea')::smallint, (v_e ->> 'producto_id')::uuid,
      nullif(v_e ->> 'serie_id', '')::uuid, v_e ->> 'lista', (v_e ->> 'cantidad')::numeric, (v_e ->> 'precio')::numeric,
      (v_e ->> 'precio_lista')::numeric, (v_e ->> 'descuento')::numeric, (v_e ->> 'total_linea')::numeric,
      v_asig - v_prev_asig, v_costo);
    v_prev_asig := v_asig;
    if (v_e ->> 'serie_id') is not null then
      update public.series set estado = 'vendida'
      where id = (v_e ->> 'serie_id')::uuid and negocio_id = v_disp.negocio_id
        and producto_id = (v_e ->> 'producto_id')::uuid and ubicacion_id = v_disp.ubicacion_id and estado = 'disponible';
      if not found then
        raise exception 'ERP_DATOS_INVALIDOS'; -- DB-15: no está disponible en la ubicación del equipo
      end if;
    end if;
  end loop;

  insert into public.venta_pagos (negocio_id, venta_id, medio, monto, verificacion)
  select v_disp.negocio_id, v_id, e ->> 'medio', (e ->> 'monto')::numeric,
    case when e ->> 'medio' = 'efectivo' then 'no_aplica' else 'verificado' end
  from jsonb_array_elements(v_pagos) e;

  insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario,
    ref_tipo, ref_id, usuario_id)
  select v_disp.negocio_id, v_disp.ubicacion_id, vi.producto_id, 'venta', -sum(vi.cantidad), max(vi.costo_unitario),
    'venta', v_id, v_uid
  from public.venta_items vi
  where vi.venta_id = v_id and vi.producto_id = any (v_stock_ids)
  group by vi.producto_id
  order by vi.producto_id;

  return jsonb_build_object('id', v_id, 'numero', v_numero, 'total', v_total);
exception
  when numeric_value_out_of_range or invalid_text_representation or check_violation or foreign_key_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'ventas_numero_uq' then
      raise exception 'ERP_NUMERO_DUPLICADO';
    end if;
    raise;
end;
$$;

-- Exige `anular`, conexión y la sesión de caja de la venta abierta (con la caja cerrada se usa devolver_venta).
-- Pasadas 24 h de la venta exige además `devolver_fuera_plazo` (RN-08), como devolver_venta.
-- Ya anulada con el mismo motivo: devuelve igual. Con devoluciones previas: ERP_VENTA_CON_DEVOLUCIONES.
-- La parte en efectivo sale del esperado: si no alcanza, ERP_EFECTIVO_INSUFICIENTE.
create function public.anular_venta(p_venta_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_venta public.ventas;
  v_sesion public.caja_sesiones;
  v_motivo text := btrim(p_motivo);
  v_stock_ids uuid[];
begin
  select * into v_venta from public.ventas where id = p_venta_id;
  if not found or not public.tiene_permiso(v_venta.negocio_id, 'anular') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_motivo is null or v_motivo = '' or length(v_motivo) > 200 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  select * into v_sesion from public.caja_sesiones where id = v_venta.caja_sesion_id for update;
  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.estado = 'anulada' then
    if v_venta.motivo_anulacion = v_motivo then
      return jsonb_build_object('id', v_venta.id, 'numero', v_venta.numero, 'estado', 'anulada');
    end if;
    raise exception 'ERP_OPERACION_REPETIDA';
  end if;
  if now() - v_venta.recibida_en > interval '24 hours'
     and not public.tiene_permiso(v_venta.negocio_id, 'devolver_fuera_plazo') then -- RN-08
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_sesion.cerrada_en is not null then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  if exists (select 1 from public.devoluciones where venta_id = p_venta_id) then
    raise exception 'ERP_VENTA_CON_DEVOLUCIONES';
  end if;
  if (select coalesce(sum(monto), 0) from public.venta_pagos where venta_id = p_venta_id and medio = 'efectivo')
     > public.efectivo_esperado(v_sesion.id) then
    raise exception 'ERP_EFECTIVO_INSUFICIENTE';
  end if;

  select array_agg(distinct vi.producto_id) into v_stock_ids
  from public.venta_items vi join public.productos p on p.id = vi.producto_id
  where vi.venta_id = p_venta_id and p.tipo <> 'servicio';
  perform public.bloquear_stock(v_venta.negocio_id, v_venta.ubicacion_id, v_stock_ids);

  insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario,
    ref_tipo, ref_id, usuario_id, motivo)
  select v_venta.negocio_id, v_venta.ubicacion_id, vi.producto_id, 'anulacion_venta', sum(vi.cantidad),
    max(vi.costo_unitario), 'venta', p_venta_id, v_uid, v_motivo
  from public.venta_items vi
  where vi.venta_id = p_venta_id and vi.producto_id = any (v_stock_ids)
  group by vi.producto_id
  order by vi.producto_id;

  update public.series set estado = 'disponible'
  where id in (select serie_id from public.venta_items where venta_id = p_venta_id and serie_id is not null);

  update public.ventas
  set estado = 'anulada', anulada_en = now(), anulada_por = v_uid, motivo_anulacion = v_motivo
  where id = p_venta_id;
  return jsonb_build_object('id', v_venta.id, 'numero', v_venta.numero, 'estado', 'anulada');
end;
$$;

-- devolver_venta(p_devolucion): {id, venta_id, dispositivo_id, caja_sesion_id, medio, motivo,
-- items: [{venta_item_id, cantidad}]}. Devuelve {id, venta_id, monto, monto_efectivo}; el resto sale por QR.
-- Monto por línea: proporcional a lo cobrado por la línea (total_linea - su parte del descuento de la venta), por
-- acumulado redondeado: nunca pasa del neto y la última fracción cierra exacta. `medio` es el preferido: el servidor
-- reparte con lo que aún queda cobrado por cada medio, así lo devuelto nunca supera lo cobrado. Si falta efectivo en
-- la caja: ERP_EFECTIVO_INSUFICIENTE. Dentro de 24 h exige `anular`; después `devolver_fuera_plazo`.
create function public.devolver_venta(p_devolucion jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_venta_id uuid;
  v_dispositivo_id uuid;
  v_caja_id uuid;
  v_medio text;
  v_motivo text;
  v_items jsonb;
  v_venta public.ventas;
  v_disp public.dispositivos;
  v_sesion public.caja_sesiones;
  v_dev public.devoluciones;
  v_e jsonb;
  v_item public.venta_items;
  v_producto public.productos;
  v_cant numeric;
  v_neto numeric;
  v_devuelta numeric;
  v_monto_prev numeric;
  v_monto numeric;
  v_total numeric := 0;
  v_rest_ef numeric;
  v_rest_qr numeric;
  v_ef numeric;
  v_lineas jsonb := '[]';
  v_item_ids uuid[] := '{}';
  v_stock_ids uuid[] := '{}';
  v_item_id uuid;
  v_huella text := md5(p_devolucion::text);
begin
  perform public.payload_claves(p_devolucion, array['id', 'venta_id', 'dispositivo_id', 'caja_sesion_id', 'medio', 'motivo', 'items']);
  v_id := public.payload_uuid(p_devolucion, 'id', false);
  v_venta_id := public.payload_uuid(p_devolucion, 'venta_id', false);
  v_dispositivo_id := public.payload_uuid(p_devolucion, 'dispositivo_id', false);
  v_caja_id := public.payload_uuid(p_devolucion, 'caja_sesion_id', false);
  v_motivo := public.payload_texto(p_devolucion, 'motivo', 200);
  v_medio := public.payload_texto(p_devolucion, 'medio', 10);
  v_items := p_devolucion -> 'items';
  if v_medio not in ('efectivo', 'qr') or jsonb_typeof(v_items) is distinct from 'array'
     or jsonb_array_length(v_items) not between 1 and 200 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  for v_e in select e from jsonb_array_elements(v_items) e loop
    perform public.payload_claves(v_e, array['venta_item_id', 'cantidad']);
    perform public.payload_uuid(v_e, 'venta_item_id', false);
    perform public.payload_numero(v_e, 'cantidad', 3);
  end loop;

  select * into v_venta from public.ventas where id = v_venta_id;
  if not found or not (public.tiene_permiso(v_venta.negocio_id, 'anular')
                       or public.tiene_permiso(v_venta.negocio_id, 'devolver_fuera_plazo')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;

  select * into v_dev from public.devoluciones where id = v_id;
  if found then
    return public.resolver_devolucion_existente(v_dev, v_venta.negocio_id, v_huella);
  end if;

  -- RN-08 / DB-14
  if now() - v_venta.recibida_en > interval '24 hours' then
    if not public.tiene_permiso(v_venta.negocio_id, 'devolver_fuera_plazo') then
      raise exception 'ERP_SIN_PERMISO';
    end if;
  elsif not public.tiene_permiso(v_venta.negocio_id, 'anular') then
    raise exception 'ERP_SIN_PERMISO';
  end if;

  select * into v_disp from public.dispositivos where id = v_dispositivo_id and negocio_id = v_venta.negocio_id;
  if not found then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  -- Locks: sesión del equipo que devuelve, luego la venta
  select * into v_sesion from public.caja_sesiones
  where id = v_caja_id and negocio_id = v_venta.negocio_id and dispositivo_id = v_dispositivo_id and cerrada_en is null
  for update;
  if not found then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  select * into v_venta from public.ventas where id = v_venta_id for update;
  select * into v_dev from public.devoluciones where id = v_id;
  if found then
    return public.resolver_devolucion_existente(v_dev, v_venta.negocio_id, v_huella);
  end if;
  if v_venta.estado <> 'completada' then
    raise exception 'ERP_VENTA_ANULADA';
  end if;

  for v_e in select e from jsonb_array_elements(v_items) e loop
    v_item_id := (v_e ->> 'venta_item_id')::uuid;
    if v_item_id = any (v_item_ids) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_item_ids := v_item_ids || v_item_id;
    select * into v_item from public.venta_items where id = v_item_id and venta_id = v_venta_id;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    select * into v_producto from public.productos where id = v_item.producto_id;
    v_cant := (v_e ->> 'cantidad')::numeric;
    if v_cant <= 0 or ((v_producto.unidad = 'unidad' or v_item.serie_id is not null) and v_cant <> trunc(v_cant)) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    select coalesce(sum(cantidad), 0), coalesce(sum(monto), 0) into v_devuelta, v_monto_prev
    from public.devolucion_items where venta_item_id = v_item_id;
    if v_cant > v_item.cantidad - v_devuelta then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_neto := v_item.total_linea - v_item.descuento_venta;
    v_monto := round(v_neto * (v_devuelta + v_cant) / v_item.cantidad, 2) - v_monto_prev;
    v_total := v_total + v_monto;
    if v_producto.tipo <> 'servicio' then
      v_stock_ids := v_stock_ids || v_item.producto_id;
    end if;
    v_lineas := v_lineas || jsonb_build_object('venta_item_id', v_item_id, 'cantidad', v_cant, 'monto', v_monto);
  end loop;

  select coalesce(sum(monto) filter (where medio = 'efectivo'), 0), coalesce(sum(monto) filter (where medio = 'qr'), 0)
  into v_rest_ef, v_rest_qr from public.venta_pagos where venta_id = v_venta_id;
  v_rest_ef := v_rest_ef - (select coalesce(sum(monto_efectivo), 0) from public.devoluciones where venta_id = v_venta_id);
  v_rest_qr := v_rest_qr - (select coalesce(sum(monto - monto_efectivo), 0) from public.devoluciones
                            where venta_id = v_venta_id);
  v_ef := case v_medio when 'efectivo' then least(v_total, v_rest_ef) else v_total - least(v_total, v_rest_qr) end;
  if v_ef > public.efectivo_esperado(v_sesion.id) then
    raise exception 'ERP_EFECTIVO_INSUFICIENTE';
  end if;

  insert into public.devoluciones (id, negocio_id, venta_id, dispositivo_id, usuario_id, motivo, monto, monto_efectivo,
    caja_sesion_id, huella)
  values (v_id, v_venta.negocio_id, v_venta_id, v_dispositivo_id, v_uid, v_motivo, v_total, v_ef, v_caja_id, v_huella)
  on conflict (id) do nothing;
  if not found then
    select * into v_dev from public.devoluciones where id = v_id;
    return public.resolver_devolucion_existente(v_dev, v_venta.negocio_id, v_huella);
  end if;

  perform public.bloquear_stock(v_venta.negocio_id, v_disp.ubicacion_id, v_stock_ids);

  insert into public.devolucion_items (negocio_id, devolucion_id, venta_item_id, cantidad, monto)
  select v_venta.negocio_id, v_id, (e ->> 'venta_item_id')::uuid, (e ->> 'cantidad')::numeric, (e ->> 'monto')::numeric
  from jsonb_array_elements(v_lineas) e;

  -- Entra al stock de la ubicación del equipo que devuelve, con el costo de la venta
  insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario,
    ref_tipo, ref_id, usuario_id, motivo)
  select v_venta.negocio_id, v_disp.ubicacion_id, vi.producto_id, 'devolucion_cliente', sum(di.cantidad),
    max(vi.costo_unitario), 'devolucion', v_id, v_uid, v_motivo
  from public.devolucion_items di join public.venta_items vi on vi.id = di.venta_item_id
  where di.devolucion_id = v_id and vi.producto_id = any (v_stock_ids)
  group by vi.producto_id
  order by vi.producto_id;

  update public.series set estado = 'disponible', ubicacion_id = v_disp.ubicacion_id
  where id in (select vi.serie_id from public.devolucion_items di join public.venta_items vi on vi.id = di.venta_item_id
               where di.devolucion_id = v_id and vi.serie_id is not null);

  return jsonb_build_object('id', v_id, 'venta_id', v_venta_id, 'monto', v_total, 'monto_efectivo', v_ef);
exception
  when numeric_value_out_of_range or invalid_text_representation or check_violation or foreign_key_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

create function public.resolver_devolucion_existente(p_dev public.devoluciones, p_negocio_id uuid, p_huella text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_dev.negocio_id <> p_negocio_id then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_dev.huella <> p_huella then
    raise exception 'ERP_OPERACION_REPETIDA';
  end if;
  return jsonb_build_object('id', p_dev.id, 'venta_id', p_dev.venta_id, 'monto', p_dev.monto,
    'monto_efectivo', p_dev.monto_efectivo);
end;
$$;

revoke all on function public.payload_claves(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.payload_uuid(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.payload_numero(jsonb, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.payload_texto(jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.payload_timestamp(jsonb, text) from public, anon, authenticated;
revoke all on function public.resolver_venta_existente(public.ventas, uuid, text) from public, anon, authenticated;
revoke all on function public.resolver_devolucion_existente(public.devoluciones, uuid, text) from public, anon, authenticated;
revoke all on function public.bloquear_stock(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.total_qr_sesion(uuid) from public, anon, authenticated;
revoke all on function public.registrar_venta(jsonb) from public, anon, authenticated;
revoke all on function public.anular_venta(uuid, text) from public, anon, authenticated;
revoke all on function public.devolver_venta(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_venta(jsonb) to authenticated;
grant execute on function public.anular_venta(uuid, text) to authenticated;
grant execute on function public.devolver_venta(jsonb) to authenticated;

-- Tope de descuento del negocio (porcentaje, 0 a 100, 2 decimales). Exige `usuarios`. Devuelve el valor guardado.
create function public.fijar_tope_descuento(p_negocio_id uuid, p_tope numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes numeric;
begin
  if not public.tiene_permiso(p_negocio_id, 'usuarios') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_tope is null or p_tope = 'NaN' or p_tope not between 0 and 100 or p_tope <> round(p_tope, 2) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  select tope_descuento into v_antes from public.negocios where id = p_negocio_id for update;
  if found and v_antes is distinct from p_tope then
    insert into public.auditoria (tabla, registro_id, negocio_id, accion, antes, despues, usuario_id)
    values ('negocios', p_negocio_id::text, p_negocio_id, 'update', jsonb_build_object('tope_descuento', v_antes),
      jsonb_build_object('tope_descuento', p_tope), (select auth.uid()));
  end if;
  update public.negocios set tope_descuento = p_tope where id = p_negocio_id;
  return p_tope;
end;
$$;

revoke all on function public.fijar_tope_descuento(uuid, numeric) from public, anon, authenticated;
grant execute on function public.fijar_tope_descuento(uuid, numeric) to authenticated;
