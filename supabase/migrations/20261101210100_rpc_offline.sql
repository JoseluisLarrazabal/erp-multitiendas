-- Fase 3, PR 1: p_offline en registrar_venta, abrir_caja y registrar_movimiento_caja; verificar_pago_qr, revisar_venta y
-- reconciliacion_ventas. Se reemplazan las funciones (drop + create, sin sobrecarga): un cliente que manda solo los
-- parámetros de antes sigue funcionando por el default null. Sin p_offline el comportamiento y los errores son los de siempre.
-- Errores: los de siempre (ERP_SIN_PERMISO, ERP_DATOS_INVALIDOS, ERP_VENTA_ANULADA, ERP_OPERACION_REPETIDA); no hay códigos nuevos.

drop function public.registrar_venta(jsonb);
drop function public.abrir_caja(uuid, uuid, uuid, numeric);
drop function public.registrar_movimiento_caja(uuid, uuid, text, numeric, text);

-- Privados (sin grant). Mismo cuerpo que tiene_permiso, pero del usuario dado: el permiso de quien vendió, no de quien envía.
create function public.tiene_permiso_de(p_usuario_id uuid, p_negocio_id uuid, p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuario_negocio un
    join public.perfiles p on p.id = un.usuario_id
    join public.negocios n on n.id = un.negocio_id
    join public.rol_permisos rp
      on rp.tipo_negocio = n.tipo and rp.rol = un.rol and rp.permiso = p_permiso
    where un.usuario_id = p_usuario_id
      and un.negocio_id = p_negocio_id
      and p.activo
  )
$$;

create or replace function public.tiene_permiso(p_negocio_id uuid, p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tiene_permiso_de((select auth.uid()), p_negocio_id, p_permiso)
$$;

-- Usuario con el negocio asignado (vendedor_id o usuario_id de p_offline).
create function public.usuario_en_negocio(p_usuario_id uuid, p_negocio_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.usuario_negocio where usuario_id = p_usuario_id and negocio_id = p_negocio_id)
$$;

-- p_offline de caja = {creada_en, usuario_id}. La hora es least(creada_en, now()): un reloj adelantado no deja un registro
-- en el futuro. Un uuid mal formado sube como invalid_text_representation: lo traduce quien llama.
create function public.offline_caja(p_offline jsonb)
returns table (hora timestamptz, usuario_id uuid)
language plpgsql
stable
set search_path = ''
as $$
begin
  perform public.payload_claves(p_offline, array['creada_en', 'usuario_id']);
  return query select least(public.payload_timestamp(p_offline, 'creada_en'), now()),
    public.payload_uuid(p_offline, 'usuario_id', false);
end;
$$;

-- registrar_venta(p_venta, p_offline): p_venta = {id, dispositivo_id, caja_sesion_id, numero, cliente_id?, creada_en_cliente,
-- descuento?, total, items: [{producto_id, lista, cantidad, precio_unitario, descuento?, serie_id?}],
-- pagos: [{medio, monto, verificado?}]}. Devuelve {id, numero, total}.
-- p_offline = {vendedor_id, tipo_cambio, numero_impreso} (tipo_cambio y numero_impreso pueden ser null o faltar; sin
-- tipo_cambio se guarda el del servidor, que es nulo si el negocio no tiene): la venta ya se cobró en el mostrador, así
-- que lo que dependía de datos que el equipo no veía se acepta y queda en motivos_revision (RN-03, RN-04):
-- producto_inactivo, sin_precio, descuento_sin_permiso (descuento o precio bajo el piso sin `descontar` de quien vendió,
-- no de quien envía), sobre_tope, renumerada, otra_cuenta (vende uno, envía otro: cierra el atajo de poner al dueño como
-- vendedor). Siguen rechazando la forma, la aritmética, `vender` de quien envía, el equipo, la caja cerrada, el salto de
-- numeración, el producto de otro negocio y la serie.
-- p_offline no entra en la huella: un primer intento en línea que sí se guardó se reenvía como offline y devuelve lo
-- original (con su origen). QR con verificado:false (pendiente) solo se acepta con p_offline.
create function public.registrar_venta(p_venta jsonb, p_offline jsonb default null)
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
  v_costo numeric;
  v_cum numeric := 0;
  v_prev_asig numeric := 0;
  v_asig numeric;
  v_constraint text;
  v_serie_id uuid;
  v_off boolean := p_offline is not null and jsonb_typeof(p_offline) <> 'null';
  v_vendedor uuid := v_uid;
  v_tc_off numeric;
  v_impreso text;
  v_motivos text[] := '{}';
  v_ref numeric;
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
       -- QR: en línea llega confirmado; offline puede venir pendiente (false), pero siempre explícito
       or (v_e ->> 'medio' = 'qr' and case when v_off then jsonb_typeof(v_e -> 'verificado') is distinct from 'boolean'
                                            else v_e -> 'verificado' is distinct from 'true'::jsonb end) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end loop;
  if v_off then
    perform public.payload_claves(p_offline, array['vendedor_id', 'tipo_cambio', 'numero_impreso']);
    v_vendedor := public.payload_uuid(p_offline, 'vendedor_id', false);
    if jsonb_typeof(p_offline -> 'tipo_cambio') <> 'null' then -- clave ausente da null y se salta
      v_tc_off := public.payload_numero(p_offline, 'tipo_cambio', 4);
      if v_tc_off <= 0 then
        raise exception 'ERP_DATOS_INVALIDOS';
      end if;
    end if;
    if jsonb_typeof(p_offline -> 'numero_impreso') <> 'null' then
      v_impreso := public.payload_texto(p_offline, 'numero_impreso', 20);
    end if;
  end if;

  -- Equipo y permiso
  select * into v_disp from public.dispositivos where id = v_dispositivo_id;
  if not found or not public.tiene_permiso(v_disp.negocio_id, 'vender') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_numero !~ '^[A-Z][0-9]{1,2}-[0-9]{6}$' or left(v_numero, length(v_disp.prefijo) + 1) <> v_disp.prefijo || '-' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_seq := right(v_numero, 6)::integer;
  if v_impreso is not null then
    if v_impreso !~ '^[A-Z][0-9]{1,2}-[0-9]{6}$' or left(v_impreso, length(v_disp.prefijo) + 1) <> v_disp.prefijo || '-' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    if v_impreso <> v_numero then
      v_motivos := v_motivos || 'renumerada'::text;
    end if;
  end if;

  -- Reenvío: devuelve lo original aunque la caja ya haya cerrado
  select * into v_existente from public.ventas where id = v_id;
  if found then
    return public.resolver_venta_existente(v_existente, v_disp.negocio_id, v_huella);
  end if;
  if v_off and not public.usuario_en_negocio(v_vendedor, v_disp.negocio_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_vendedor <> v_uid then
    v_motivos := v_motivos || 'otra_cuenta'::text;
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
    where id = (v_e ->> 'producto_id')::uuid and negocio_id = v_disp.negocio_id and (activo or v_off) for share;
    if not found or (v_producto.tipo = 'servicio' and v_negocio.tipo <> 'lavanderia') then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    if not v_producto.activo then
      v_motivos := v_motivos || 'producto_inactivo'::text;
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
      if not v_off then
        raise exception 'ERP_PRODUCTO_SIN_PRECIO';
      end if;
      v_srv := null;
      v_motivos := v_motivos || 'sin_precio'::text;
    end if;
    -- Piso de la línea: el menor entre el mínimo y la lista elegida, para no castigar una lista publicada bajo el
    -- mínimo. Entre el piso y la lista se negocia sin permiso; bajo el piso exige `descontar` y la brecha cuenta como
    -- descuento y como base del tope (bajar el precio no achica la base).
    -- Sin lista no hay piso (least ignora nulos y dejaría al mínimo como piso de una lista que no existe).
    v_min := public.precio_bs(v_producto.id, 'minimo');
    v_ref := case when v_srv is null then null else least(v_min, v_srv) end;
    v_bruto := round(v_cant * v_precio, 2);
    v_piso := coalesce(round(v_cant * v_ref, 2), 0);
    if v_desc > 0 or coalesce(v_precio < v_ref, false) then
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
  if v_pide_descuento and not public.tiene_permiso_de(v_vendedor, v_disp.negocio_id, 'descontar') then
    if not v_off then
      raise exception 'ERP_SIN_PERMISO';
    end if;
    v_motivos := v_motivos || 'descuento_sin_permiso'::text;
  end if;
  if v_desc_total > v_base * v_negocio.tope_descuento / 100 then
    if not v_off then
      raise exception 'ERP_DESCUENTO_TOPE';
    end if;
    v_motivos := v_motivos || 'sobre_tope'::text;
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

  select coalesce(array_agg(distinct m order by m), '{}') into v_motivos from unnest(v_motivos) m;
  insert into public.ventas (id, negocio_id, ubicacion_id, dispositivo_id, caja_sesion_id, numero, vendedor_id, enviada_por,
    cliente_id, origen, creada_en_cliente, subtotal, descuento, total, tipo_cambio, huella, motivos_revision)
  values (v_id, v_disp.negocio_id, v_disp.ubicacion_id, v_dispositivo_id, v_caja_id, v_numero, v_vendedor, v_uid,
    v_cliente_id, case when v_off then 'offline' else 'online' end, v_creada, v_subtotal, v_desc_venta, v_total,
    coalesce(v_tc_off, v_tc), v_huella, v_motivos)
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
    case when e ->> 'medio' = 'efectivo' then 'no_aplica'
         when (e ->> 'verificado')::boolean then 'verificado' else 'pendiente' end
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

-- abrir_caja con p_offline = {creada_en, usuario_id}: la apertura se hizo sin conexión. La hora es least(creada_en, now())
-- y usuario_id (con el negocio asignado) es quien abrió. Siempre queda en enviada_por quien llamó y en origen desde dónde.
-- El reenvío compara solo equipo y monto, como siempre: p_offline no entra.
create function public.abrir_caja(
  p_id uuid, p_negocio_id uuid, p_dispositivo_id uuid, p_monto_inicial numeric, p_offline jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesion public.caja_sesiones;
  v_off boolean := p_offline is not null and jsonb_typeof(p_offline) <> 'null';
  v_hora timestamptz;
  v_usuario uuid := (select auth.uid());
begin
  if not public.tiene_permiso(p_negocio_id, 'caja') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_id is null or p_monto_inicial is null or p_monto_inicial = 'NaN' or p_monto_inicial < 0
     or p_monto_inicial <> round(p_monto_inicial, 2) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_off then
    select o.hora, o.usuario_id into v_hora, v_usuario from public.offline_caja(p_offline) o;
  end if;
  -- Bloquea el equipo: dos aperturas simultáneas se serializan y la segunda ve la primera.
  -- no key update: no frena los chequeos de FK que apuntan al equipo.
  perform 1 from public.dispositivos where id = p_dispositivo_id and negocio_id = p_negocio_id for no key update;
  if not found then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  -- Repetir con el id de una sesión ya cerrada devuelve ese id aunque hoy haya otra abierta;
  -- el cliente confirma con caja_sesion_abierta.
  select * into v_sesion from public.caja_sesiones where id = p_id;
  if not found then
    if exists (select 1 from public.caja_sesiones where dispositivo_id = p_dispositivo_id and cerrada_en is null) then
      raise exception 'ERP_CAJA_ABIERTA';
    end if;
    if v_off and not public.usuario_en_negocio(v_usuario, p_negocio_id) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    -- El mismo id en otro equipo en paralelo: no inserta y relee la fila ganadora (que cae en REPETIDA).
    insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, abierta_en, monto_inicial, origen,
      enviada_por)
    values (p_id, p_negocio_id, p_dispositivo_id, v_usuario, coalesce(v_hora, now()), p_monto_inicial,
      case when v_off then 'offline' else 'online' end, (select auth.uid()))
    on conflict (id) do nothing;
    select * into v_sesion from public.caja_sesiones where id = p_id;
  end if;
  if v_sesion.negocio_id <> p_negocio_id then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_sesion.dispositivo_id <> p_dispositivo_id or v_sesion.monto_inicial <> p_monto_inicial then
    raise exception 'ERP_OPERACION_REPETIDA';
  end if;
  return p_id;
exception
  when numeric_value_out_of_range or invalid_text_representation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- registrar_movimiento_caja con p_offline = {creada_en, usuario_id}: mismo criterio de hora, usuario y rastro que
-- abrir_caja, y la hora nunca queda antes de la apertura de la sesión (un reloj atrasado). Offline no aplica ERP_EFECTIVO_INSUFICIENTE: el gasto ya ocurrió y la diferencia se ve en el arqueo.
create function public.registrar_movimiento_caja(
  p_id uuid, p_sesion_id uuid, p_tipo text, p_monto numeric, p_motivo text, p_offline jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesion public.caja_sesiones;
  v_mov public.caja_movimientos;
  v_off boolean := p_offline is not null and jsonb_typeof(p_offline) <> 'null';
  v_hora timestamptz;
  v_usuario uuid := (select auth.uid());
begin
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id;
  if not found or not public.tiene_permiso(v_sesion.negocio_id, 'caja') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_id is null or p_tipo is null or p_tipo not in ('ingreso', 'gasto', 'retiro')
     or p_monto is null or p_monto = 'NaN' or p_monto <= 0 or p_monto <> round(p_monto, 2)
     or p_motivo is null or btrim(p_motivo) = '' or length(btrim(p_motivo)) > 200 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_off then
    select o.hora, o.usuario_id into v_hora, v_usuario from public.offline_caja(p_offline) o;
  end if;
  -- for update: serializa movimientos y cierre de la sesión (un equipo, un cajero); dos retiros no pasan ambos el chequeo de efectivo.
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id for update;

  select * into v_mov from public.caja_movimientos where id = p_id;
  if not found then
    if v_sesion.cerrada_en is not null then
      raise exception 'ERP_CAJA_CERRADA';
    end if;
    if v_off and not public.usuario_en_negocio(v_usuario, v_sesion.negocio_id) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    if not v_off and p_tipo in ('gasto', 'retiro') and p_monto > public.efectivo_esperado(p_sesion_id) then
      raise exception 'ERP_EFECTIVO_INSUFICIENTE';
    end if;
    -- Dos llamadas simultáneas con el mismo id: la segunda espera, no inserta y relee la fila de la primera.
    insert into public.caja_movimientos (id, negocio_id, sesion_id, tipo, monto, motivo, usuario_id, created_at, origen,
      enviada_por)
    values (p_id, v_sesion.negocio_id, p_sesion_id, p_tipo, p_monto, btrim(p_motivo), v_usuario,
      case when v_off then greatest(v_hora, v_sesion.abierta_en) else now() end,
      case when v_off then 'offline' else 'online' end, (select auth.uid()))
    on conflict (id) do nothing;
    select * into v_mov from public.caja_movimientos where id = p_id;
  end if;
  if v_mov.negocio_id <> v_sesion.negocio_id then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_mov.sesion_id <> p_sesion_id or v_mov.tipo <> p_tipo or v_mov.monto <> p_monto
     or v_mov.motivo <> btrim(p_motivo) then
    raise exception 'ERP_OPERACION_REPETIDA';
  end if;
  return p_id;
exception
  when numeric_value_out_of_range or invalid_text_representation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- verificar_pago_qr(p_pago_id, p_cobrado): exige `ver_reportes` en el negocio del pago (no confirma si el pago existe).
-- Solo QR: pendiente pasa a verificado (p_cobrado true, el QR llegó) o a rechazado (false, nunca llegó), con quién y cuándo.
-- Idempotente: repetir el mismo resultado devuelve igual; pedir el contrario sobre un pago ya resuelto (también el
-- verificado de origen) es ERP_OPERACION_REPETIDA. En una venta anulada pendiente = ERP_VENTA_ANULADA: el cobro ya se
-- revirtió con la anulación y no queda nada que resolver (la lista de reconciliación tampoco la muestra).
-- Un pago rechazado deja de contar en total_qr_sesion y sale de la reconciliación. La venta sigue completada y su stock
-- no vuelve: anularla o devolverla es decisión del encargado. devolver_venta no mira la verificación: con un QR
-- rechazado no falla, pero reparte la devolución QR sobre ese monto como si hubiera entrado (ver el reporte del PR).
create function public.verificar_pago_qr(p_pago_id uuid, p_cobrado boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pago public.venta_pagos;
  v_venta public.ventas;
  v_resultado text := case when p_cobrado then 'verificado' else 'rechazado' end;
begin
  select * into v_pago from public.venta_pagos where id = p_pago_id;
  if not found or not public.tiene_permiso(v_pago.negocio_id, 'ver_reportes') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_pago.medio <> 'qr' or p_cobrado is null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  -- Orden de locks: venta (share, frena a anular_venta), luego el pago.
  select * into v_venta from public.ventas where id = v_pago.venta_id for share;
  select * into v_pago from public.venta_pagos where id = p_pago_id for update;
  if v_pago.verificacion = 'pendiente' then
    if v_venta.estado = 'anulada' then
      raise exception 'ERP_VENTA_ANULADA';
    end if;
    update public.venta_pagos set verificacion = v_resultado, verificado_por = v_uid, verificado_en = now()
    where id = p_pago_id;
  elsif v_pago.verificacion <> v_resultado then
    raise exception 'ERP_OPERACION_REPETIDA';
  end if;
  return jsonb_build_object('id', p_pago_id, 'venta_id', v_pago.venta_id, 'verificacion', v_resultado);
end;
$$;

-- Exige `ver_reportes`. Cierra las marcas de motivos_revision (quién y cuándo); ya revisada devuelve igual. Una venta sin
-- motivos no tiene nada que revisar (ERP_DATOS_INVALIDOS) y una anulada ya no se revisa (ERP_VENTA_ANULADA).
create function public.revisar_venta(p_venta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_venta public.ventas;
begin
  select * into v_venta from public.ventas where id = p_venta_id;
  if not found or not public.tiene_permiso(v_venta.negocio_id, 'ver_reportes') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.revisada_por is null then
    if cardinality(v_venta.motivos_revision) = 0 then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    if v_venta.estado = 'anulada' then
      raise exception 'ERP_VENTA_ANULADA';
    end if;
    update public.ventas set revisada_por = v_uid, revisada_en = now() where id = p_venta_id
    returning * into v_venta;
  end if;
  return jsonb_build_object('id', v_venta.id, 'revisada_por', v_venta.revisada_por, 'revisada_en', v_venta.revisada_en);
end;
$$;

-- Ventas offline completadas por revisar: con motivos sin revisar, o con algún pago QR pendiente. Las anuladas no entran:
-- su stock y su caja ya se revirtieron. Más reciente primero; paginación por (recibida_en, id): p_desde_id es el id de la
-- última venta de la página anterior. Exige `ver_reportes`.
create function public.reconciliacion_ventas(p_negocio_id uuid, p_limite integer default 50, p_desde_id uuid default null)
returns table (
  id uuid, numero text, creada_en_cliente timestamptz, recibida_en timestamptz, vendedor_id uuid, vendedor_nombre text,
  enviada_por uuid, enviada_por_nombre text, total numeric, motivos_revision text[], pagos_pendientes jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_desde_fecha timestamptz;
begin
  if not public.tiene_permiso(p_negocio_id, 'ver_reportes') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 500 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if p_desde_id is not null then
    select v.recibida_en into v_desde_fecha from public.ventas v where v.id = p_desde_id and v.negocio_id = p_negocio_id;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end if;

  return query
    select v.id, v.numero, v.creada_en_cliente, v.recibida_en, v.vendedor_id, pv.nombre, v.enviada_por, pe.nombre, v.total,
      v.motivos_revision,
      coalesce((select jsonb_agg(jsonb_build_object('id', vp.id, 'monto', vp.monto) order by vp.id)
                from public.venta_pagos vp where vp.venta_id = v.id and vp.verificacion = 'pendiente'), '[]'::jsonb)
    from public.ventas v
    left join public.perfiles pv on pv.id = v.vendedor_id
    left join public.perfiles pe on pe.id = v.enviada_por
    where v.negocio_id = p_negocio_id and v.origen = 'offline' and v.estado = 'completada'
      and ((cardinality(v.motivos_revision) > 0 and v.revisada_por is null)
           or exists (select 1 from public.venta_pagos vp where vp.venta_id = v.id and vp.verificacion = 'pendiente'))
      and (p_desde_id is null or (v.recibida_en, v.id) < (v_desde_fecha, p_desde_id))
    order by v.recibida_en desc, v.id desc
    limit p_limite;
end;
$$;

-- Totales de QR: lo rechazado nunca entró, no suma. Misma firma y cuerpo que en 20261101190100 salvo ese filtro; así
-- también lo heredan cerrar_caja (total_qr) y resumen_caja (qr_neto).
create or replace function public.total_qr_sesion(p_sesion_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce((select sum(vp.monto) from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
                   where v.caja_sesion_id = p_sesion_id and v.estado = 'completada' and vp.medio = 'qr'
                     and vp.verificacion <> 'rechazado'), 0)
    - coalesce((select sum(d.monto - d.monto_efectivo) from public.devoluciones d
                where d.caja_sesion_id = p_sesion_id), 0)
$$;

-- resumen_caja (20261101200000) más qr_pendiente: QR de ventas completadas aún sin confirmar, para que el arqueo muestre
-- cuánto falta. En vivo (pendiente hoy), mismo snapshot que el resto. qr_neto ya lo incluye hasta que se resuelva.
create or replace function public.resumen_caja(p_sesion_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_res jsonb;
begin
  select negocio_id into v_negocio_id from public.caja_sesiones where id = p_sesion_id;
  if v_negocio_id is null
     or not (public.tiene_permiso(v_negocio_id, 'caja') or public.tiene_permiso(v_negocio_id, 'ver_reportes')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  select jsonb_build_object(
    'monto_inicial', s.monto_inicial,
    'ventas_efectivo', coalesce((select sum(vp.monto) from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
                                 where v.caja_sesion_id = s.id and v.estado = 'completada' and vp.medio = 'efectivo'), 0),
    'ingresos', coalesce((select sum(m.monto) from public.caja_movimientos m where m.sesion_id = s.id and m.tipo = 'ingreso'), 0),
    'gastos', coalesce((select sum(m.monto) from public.caja_movimientos m where m.sesion_id = s.id and m.tipo = 'gasto'), 0),
    'retiros', coalesce((select sum(m.monto) from public.caja_movimientos m where m.sesion_id = s.id and m.tipo = 'retiro'), 0),
    'devoluciones_efectivo', coalesce((select sum(d.monto_efectivo) from public.devoluciones d where d.caja_sesion_id = s.id), 0),
    'esperado', public.efectivo_esperado(s.id),
    'qr_neto', public.total_qr_sesion(s.id),
    'qr_pendiente', coalesce((select sum(vp.monto) from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
                              where v.caja_sesion_id = s.id and v.estado = 'completada' and vp.medio = 'qr'
                                and vp.verificacion = 'pendiente'), 0),
    'cantidad_ventas', (select count(*) from public.ventas v where v.caja_sesion_id = s.id),
    'cantidad_movimientos', (select count(*) from public.caja_movimientos m where m.sesion_id = s.id)
  ) into v_res
  from public.caja_sesiones s where s.id = p_sesion_id;
  return v_res;
end;
$$;

revoke all on function public.tiene_permiso_de(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.usuario_en_negocio(uuid, uuid) from public, anon, authenticated;
revoke all on function public.offline_caja(jsonb) from public, anon, authenticated;
revoke all on function public.registrar_venta(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.abrir_caja(uuid, uuid, uuid, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.registrar_movimiento_caja(uuid, uuid, text, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function public.verificar_pago_qr(uuid, boolean) from public, anon, authenticated;
revoke all on function public.revisar_venta(uuid) from public, anon, authenticated;
revoke all on function public.reconciliacion_ventas(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.registrar_venta(jsonb, jsonb) to authenticated;
grant execute on function public.abrir_caja(uuid, uuid, uuid, numeric, jsonb) to authenticated;
grant execute on function public.registrar_movimiento_caja(uuid, uuid, text, numeric, text, jsonb) to authenticated;
grant execute on function public.verificar_pago_qr(uuid, boolean) to authenticated;
grant execute on function public.revisar_venta(uuid) to authenticated;
grant execute on function public.reconciliacion_ventas(uuid, integer, uuid) to authenticated;
