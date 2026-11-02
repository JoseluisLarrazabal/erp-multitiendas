-- Fase 4, PR 1: lavandería. La orden es una venta más su ficha (ordenes.id = ventas.id): el cobro, la caja, el QR, la
-- numeración y la reconciliación son los de la venta. Errores nuevos: ERP_ORDEN_ESTADO (cambio de estado no permitido) y
-- ERP_ES_ORDEN (anular o devolver desde Ventas una venta con orden activa: se anula desde la orden).

create table public.ordenes (
  id uuid primary key,
  negocio_id uuid not null,
  estado text not null default 'recibida' check (estado in ('recibida', 'en_lavado', 'lista', 'entregada', 'cancelada')),
  -- Cambia con cada estado: base de la ropa sin recoger (RN-09).
  estado_en timestamptz not null default now(),
  recibida_por uuid not null references public.perfiles (id),
  -- Foto: con cliente_id sale de clientes; sin conexión, lo escrito en el mostrador.
  cliente_nombre text not null check (btrim(cliente_nombre) <> '' and length(cliente_nombre) <= 200),
  cliente_telefono text check (cliente_telefono is null or (btrim(cliente_telefono) <> '' and length(cliente_telefono) <= 30)),
  express boolean not null,
  prendas integer not null check (prendas between 1 and 999),
  casillero text check (casillero is null or (btrim(casillero) <> '' and length(casillero) <= 20)),
  fecha_prometida date not null,
  nota text check (nota is null or (btrim(nota) <> '' and length(nota) <= 500)),
  retirada_por text check (retirada_por is null or (btrim(retirada_por) <> '' and length(retirada_por) <= 120)),
  retiro_con text check (retiro_con in ('boleta', 'carnet')),
  documento_retiro text check (documento_retiro is null or (btrim(documento_retiro) <> '' and length(documento_retiro) <= 30)),
  entregada_por uuid references public.perfiles (id),
  entregada_en timestamptz,
  motivo_anulacion text check (motivo_anulacion is null or (btrim(motivo_anulacion) <> '' and length(motivo_anulacion) <= 200)),
  anulada_por uuid references public.perfiles (id),
  -- md5 de p_orden: reenviar el mismo id con otros datos es ERP_OPERACION_REPETIDA.
  huella text not null,
  foreign key (negocio_id, id) references public.ventas (negocio_id, id),
  unique (negocio_id, id),
  constraint ordenes_entrega_ck check (
    (estado = 'entregada') = (retirada_por is not null and retiro_con is not null and entregada_por is not null
                              and entregada_en is not null)
    and (retirada_por is null) = (retiro_con is null)
    and (retirada_por is null) = (entregada_por is null)
    and (retirada_por is null) = (entregada_en is null)
    and (retiro_con is distinct from 'carnet' or documento_retiro is not null)
    and (documento_retiro is null or retiro_con = 'carnet')),
  constraint ordenes_anulacion_ck check (
    (estado = 'cancelada') = (motivo_anulacion is not null and anulada_por is not null)
    and (motivo_anulacion is null) = (anulada_por is null))
);
create index ordenes_estado_idx on public.ordenes (negocio_id, estado, estado_en);

create table public.orden_eventos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null,
  orden_id uuid not null,
  estado text not null check (estado in ('recibida', 'en_lavado', 'lista', 'entregada', 'cancelada')),
  usuario_id uuid not null references public.perfiles (id),
  motivo text,
  created_at timestamptz not null default now(),
  foreign key (negocio_id, orden_id) references public.ordenes (negocio_id, id)
);
create index orden_eventos_orden_idx on public.orden_eventos (orden_id, created_at);

-- La orden solo cambia de estado y de datos de entrega o anulación (por RPC); la ficha de recepción no se toca.
create function public.orden_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     or (new.id, new.negocio_id, new.recibida_por, new.huella, new.cliente_nombre, new.cliente_telefono, new.express,
         new.prendas, new.fecha_prometida)
        is distinct from
        (old.id, old.negocio_id, old.recibida_por, old.huella, old.cliente_nombre, old.cliente_telefono, old.express,
         old.prendas, old.fecha_prometida) then
    raise exception 'ERP_SOLO_AGREGAR';
  end if;
  return new;
end;
$$;
revoke all on function public.orden_inmutable() from public, anon, authenticated;

create trigger ordenes_inmutable
  before update or delete on public.ordenes
  for each row execute function public.orden_inmutable();
create trigger ordenes_sin_truncate
  before truncate on public.ordenes
  for each statement execute function public.rechazar_modificacion();
create trigger orden_eventos_solo_agregar
  before update or delete on public.orden_eventos
  for each row execute function public.rechazar_modificacion();
create trigger orden_eventos_sin_truncate
  before truncate on public.orden_eventos
  for each statement execute function public.rechazar_modificacion();

alter table public.ordenes enable row level security;
alter table public.orden_eventos enable row level security;
create policy ordenes_select on public.ordenes for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
create policy orden_eventos_select on public.orden_eventos for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
revoke all on public.ordenes from anon, authenticated, public;
revoke all on public.orden_eventos from anon, authenticated, public;
-- Todo menos huella.
grant select (id, negocio_id, estado, estado_en, recibida_por, cliente_nombre, cliente_telefono, express, prendas, casillero,
  fecha_prometida, nota, retirada_por, retiro_con, documento_retiro, entregada_por, entregada_en, motivo_anulacion,
  anulada_por) on public.ordenes to authenticated;
grant select on public.orden_eventos to authenticated;

-- Venta de lavandería sin cliente: solo con p_offline (el equipo no busca clientes sin red); queda marcada para revisión.
alter table public.ventas drop constraint ventas_motivos_revision_check;
alter table public.ventas add constraint ventas_motivos_revision_check
  check (motivos_revision <@ array['producto_inactivo', 'sin_precio', 'descuento_sin_permiso', 'sobre_tope', 'renumerada',
    'otra_cuenta', 'sin_cliente']);


-- Reemplazos (misma firma, mismo cuerpo salvo lo indicado).
-- registrar_venta(p_venta, p_offline): p_venta = {id, dispositivo_id, caja_sesion_id, numero, cliente_id?, creada_en_cliente,
-- descuento?, total, items: [{producto_id, lista, cantidad, precio_unitario, descuento?, serie_id?}],
-- pagos: [{medio, monto, verificado?}]}. Devuelve {id, numero, total}.
-- p_offline = {vendedor_id, tipo_cambio, numero_impreso} (tipo_cambio y numero_impreso pueden ser null o faltar; sin
-- tipo_cambio se guarda el del servidor, que es nulo si el negocio no tiene): la venta ya se cobró en el mostrador, así
-- que lo que dependía de datos que el equipo no veía se acepta y queda en motivos_revision (RN-03, RN-04):
-- producto_inactivo, sin_precio, descuento_sin_permiso (descuento o precio bajo el piso sin `descontar` de quien vendió,
-- no de quien envía), sobre_tope, renumerada, sin_cliente (lavandería sin cliente, solo offline), otra_cuenta (vende uno, envía otro: cierra el atajo de poner al dueño como
-- vendedor). Siguen rechazando la forma, la aritmética, `vender` de quien envía, el equipo, la caja cerrada, el salto de
-- numeración, el producto de otro negocio y la serie.
-- p_offline no entra en la huella: un primer intento en línea que sí se guardó se reenvía como offline y devuelve lo
-- original (con su origen). QR con verificado:false (pendiente) solo se acepta con p_offline.
create or replace function public.registrar_venta(p_venta jsonb, p_offline jsonb default null)
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
    if not v_off then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_motivos := v_motivos || 'sin_cliente'::text; -- offline: el equipo no busca clientes; queda para revisión (fase 4)
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

-- Exige `anular`, conexión y la sesión de caja de la venta abierta (con la caja cerrada se usa devolver_venta).
-- Pasadas 24 h de la venta exige además `devolver_fuera_plazo` (RN-08), como devolver_venta.
-- Ya anulada con el mismo motivo: devuelve igual. Con devoluciones previas: ERP_VENTA_CON_DEVOLUCIONES.
-- La parte en efectivo sale del esperado: si no alcanza, ERP_EFECTIVO_INSUFICIENTE.
create or replace function public.anular_venta(p_venta_id uuid, p_motivo text)
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
  if exists (select 1 from public.ordenes where id = p_venta_id and estado in ('recibida', 'en_lavado', 'lista')) then
    raise exception 'ERP_ES_ORDEN'; -- orden activa: se anula desde la orden (anular_orden); entregada/cancelada ya no
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
create or replace function public.devolver_venta(p_devolucion jsonb)
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
  if exists (select 1 from public.ordenes where id = v_venta.id and estado in ('recibida', 'en_lavado', 'lista')) then
    raise exception 'ERP_ES_ORDEN'; -- orden activa: se anula desde la orden (anular_orden); entregada/cancelada ya no
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

revoke all on function public.registrar_venta(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.anular_venta(uuid, text) from public, anon, authenticated;
revoke all on function public.devolver_venta(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_venta(jsonb, jsonb) to authenticated;
grant execute on function public.anular_venta(uuid, text) to authenticated;
grant execute on function public.devolver_venta(jsonb) to authenticated;

-- crear_orden(p_venta, p_orden, p_offline): p_orden = {cliente_nombre?, cliente_telefono?, express, prendas, casillero?,
-- fecha_prometida, nota?}. Registra la venta (registrar_venta, idempotente, con todas sus reglas) y su ficha en la misma
-- transacción. Con cliente_id la foto sale de clientes; sin él, cliente_nombre es obligatorio. Los ítems son servicios de
-- la lista normal (o express si express). Devuelve {id, numero, total, estado}.
create function public.crear_orden(p_venta jsonb, p_orden jsonb, p_offline jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_huella text := md5(p_orden::text);
  v_res jsonb;
  v_venta public.ventas;
  v_negocio_tipo text;
  v_ord public.ordenes;
  v_cli public.clientes;
  v_nombre text;
  v_tel text;
  v_casillero text;
  v_nota text;
  v_express boolean;
  v_prendas numeric;
  v_fecha date;
  v_k text;
begin
  perform public.payload_claves(p_orden, array['cliente_nombre', 'cliente_telefono', 'express', 'prendas', 'casillero',
    'fecha_prometida', 'nota']);
  if jsonb_typeof(p_orden -> 'express') is distinct from 'boolean' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_express := (p_orden ->> 'express')::boolean;
  v_prendas := public.payload_numero(p_orden, 'prendas', 0);
  if v_prendas not between 1 and 999 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if jsonb_typeof(p_orden -> 'fecha_prometida') is distinct from 'string'
     or p_orden ->> 'fecha_prometida' !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_fecha := (p_orden ->> 'fecha_prometida')::date;
  -- Opcionales: ausentes o null valen null; si vienen, deben ser texto dentro del largo.
  foreach v_k in array array['cliente_nombre', 'cliente_telefono', 'casillero', 'nota'] loop
    if p_orden -> v_k is not null and jsonb_typeof(p_orden -> v_k) <> 'null' then
      perform public.payload_texto(p_orden, v_k, case v_k when 'nota' then 500 when 'cliente_nombre' then 200
        when 'cliente_telefono' then 30 else 20 end);
    end if;
  end loop;
  v_nombre := btrim(p_orden ->> 'cliente_nombre');
  v_tel := btrim(p_orden ->> 'cliente_telefono');
  v_casillero := btrim(p_orden ->> 'casillero');
  v_nota := btrim(p_orden ->> 'nota');

  v_id := public.payload_uuid(p_venta, 'id', false);
  v_res := public.registrar_venta(p_venta, p_offline);

  select * into v_ord from public.ordenes where id = v_id;
  if found then
    if v_ord.huella <> v_huella then
      raise exception 'ERP_OPERACION_REPETIDA';
    end if;
    return jsonb_build_object('id', v_id, 'numero', v_res ->> 'numero', 'total', v_res -> 'total', 'estado', v_ord.estado);
  end if;

  select * into v_venta from public.ventas where id = v_id;
  if v_venta.estado <> 'completada' then
    raise exception 'ERP_VENTA_ANULADA';
  end if;
  select tipo into v_negocio_tipo from public.negocios where id = v_venta.negocio_id;
  if v_negocio_tipo <> 'lavanderia'
     or exists (
       select 1 from public.venta_items vi join public.productos p on p.id = vi.producto_id
       where vi.venta_id = v_id
         and (p.tipo <> 'servicio' or vi.lista <> case when v_express then 'express' else 'normal' end))
     or (p_offline is null and v_fecha < (v_venta.creada_en_cliente at time zone 'America/La_Paz')::date) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_venta.cliente_id is not null then
    select * into v_cli from public.clientes where id = v_venta.cliente_id and negocio_id = v_venta.negocio_id;
    v_nombre := v_cli.nombre;
    v_tel := v_cli.telefono;
  elsif v_nombre is null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  insert into public.ordenes (id, negocio_id, estado_en, recibida_por, cliente_nombre, cliente_telefono, express, prendas,
    casillero, fecha_prometida, nota, huella)
  values (v_id, v_venta.negocio_id, v_venta.recibida_en, v_venta.vendedor_id, v_nombre, v_tel, v_express, v_prendas::integer,
    v_casillero, v_fecha, v_nota, v_huella)
  on conflict (id) do nothing;
  if not found then -- otra llamada con el mismo id ganó en paralelo
    select * into v_ord from public.ordenes where id = v_id;
    if v_ord.huella <> v_huella then
      raise exception 'ERP_OPERACION_REPETIDA';
    end if;
    return jsonb_build_object('id', v_id, 'numero', v_res ->> 'numero', 'total', v_res -> 'total', 'estado', v_ord.estado);
  end if;
  insert into public.orden_eventos (negocio_id, orden_id, estado, usuario_id)
  values (v_venta.negocio_id, v_id, 'recibida', v_venta.vendedor_id);
  return jsonb_build_object('id', v_id, 'numero', v_res ->> 'numero', 'total', v_res -> 'total', 'estado', 'recibida');
exception
  when numeric_value_out_of_range or invalid_text_representation or check_violation or foreign_key_violation
       or datetime_field_overflow then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- Pasos permitidos: recibida <-> en_lavado <-> lista (volver un paso corrige un clic). Mismo estado: sin cambios.
create function public.cambiar_estado_orden(p_orden_id uuid, p_estado text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ord public.ordenes;
  v_pasos text[] := array['recibida', 'en_lavado', 'lista'];
begin
  select * into v_ord from public.ordenes where id = p_orden_id for update;
  if not found or not public.tiene_permiso(v_ord.negocio_id, 'cambiar_estado_orden') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_estado is null or p_estado not in ('recibida', 'en_lavado', 'lista', 'entregada', 'cancelada') then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_ord.estado = p_estado then
    return jsonb_build_object('id', v_ord.id, 'estado', v_ord.estado);
  end if;
  if p_estado <> all (v_pasos) or v_ord.estado <> all (v_pasos)
     or abs(array_position(v_pasos, p_estado) - array_position(v_pasos, v_ord.estado)) <> 1 then
    raise exception 'ERP_ORDEN_ESTADO';
  end if;
  update public.ordenes set estado = p_estado, estado_en = now() where id = p_orden_id;
  insert into public.orden_eventos (negocio_id, orden_id, estado, usuario_id) values (v_ord.negocio_id, p_orden_id, p_estado, v_uid);
  return jsonb_build_object('id', p_orden_id, 'estado', p_estado);
end;
$$;

-- Solo desde lista. Carnet exige documento; con boleta el documento no se guarda. Mismos datos otra vez: devuelve igual.
create function public.entregar_orden(p_orden_id uuid, p_retirada_por text, p_retiro_con text, p_documento text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ord public.ordenes;
  v_quien text := btrim(p_retirada_por);
  v_doc text := case when p_retiro_con = 'carnet' then btrim(p_documento) end;
begin
  select * into v_ord from public.ordenes where id = p_orden_id for update;
  if not found or not public.tiene_permiso(v_ord.negocio_id, 'cambiar_estado_orden') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_quien is null or v_quien = '' or length(v_quien) > 120 or p_retiro_con is null or p_retiro_con not in ('boleta', 'carnet')
     or (p_retiro_con = 'carnet' and (v_doc is null or v_doc = '' or length(v_doc) > 30)) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_ord.estado = 'entregada' then
    if (v_ord.retirada_por, v_ord.retiro_con, v_ord.documento_retiro) is distinct from (v_quien, p_retiro_con, v_doc) then
      raise exception 'ERP_OPERACION_REPETIDA';
    end if;
    return jsonb_build_object('id', v_ord.id, 'estado', 'entregada');
  end if;
  if v_ord.estado <> 'lista' then
    raise exception 'ERP_ORDEN_ESTADO';
  end if;
  update public.ordenes
  set estado = 'entregada', estado_en = now(), retirada_por = v_quien, retiro_con = p_retiro_con, documento_retiro = v_doc,
      entregada_por = v_uid, entregada_en = now()
  where id = p_orden_id;
  insert into public.orden_eventos (negocio_id, orden_id, estado, usuario_id) values (v_ord.negocio_id, p_orden_id, 'entregada', v_uid);
  return jsonb_build_object('id', p_orden_id, 'estado', 'entregada');
end;
$$;

-- Desde recibida, en_lavado o lista. Cancela la orden primero y, si la caja de la venta sigue abierta, anula la venta (el
-- efectivo vuelve a esa caja): reembolso true. Con la caja cerrada no toca el dinero (reembolso false): se devuelve desde Ventas.
create function public.anular_orden(p_orden_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ord public.ordenes;
  v_motivo text := btrim(p_motivo);
  v_venta public.ventas;
  v_sesion public.caja_sesiones;
begin
  -- Orden de locks igual que anular_venta/devolver_venta/cerrar_caja: caja_sesiones antes que orden y venta. Bloquear la
  -- caja primero evita el deadlock con anular_venta y fija si está abierta (reembolso) o cerrada hasta el final.
  select * into v_venta from public.ventas where id = p_orden_id;
  if not found then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  select * into v_sesion from public.caja_sesiones where id = v_venta.caja_sesion_id for update;
  select * into v_ord from public.ordenes where id = p_orden_id for update;
  if not found or not public.tiene_permiso(v_ord.negocio_id, 'anular') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_motivo is null or v_motivo = '' or length(v_motivo) > 200 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_ord.estado = 'cancelada' then
    if v_ord.motivo_anulacion <> v_motivo then
      raise exception 'ERP_OPERACION_REPETIDA';
    end if;
    return jsonb_build_object('id', p_orden_id, 'estado', 'cancelada', 'reembolso', v_venta.estado = 'anulada');
  end if;
  if v_ord.estado = 'entregada' then
    raise exception 'ERP_ORDEN_ESTADO';
  end if;
  update public.ordenes
  set estado = 'cancelada', estado_en = now(), motivo_anulacion = v_motivo, anulada_por = v_uid
  where id = p_orden_id;
  insert into public.orden_eventos (negocio_id, orden_id, estado, usuario_id, motivo)
  values (v_ord.negocio_id, p_orden_id, 'cancelada', v_uid, v_motivo);
  if v_sesion.cerrada_en is null then
    perform public.anular_venta(p_orden_id, v_motivo);
    return jsonb_build_object('id', p_orden_id, 'estado', 'cancelada', 'reembolso', true);
  end if;
  return jsonb_build_object('id', p_orden_id, 'estado', 'cancelada', 'reembolso', false);
end;
$$;

revoke all on function public.crear_orden(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.cambiar_estado_orden(uuid, text) from public, anon, authenticated;
revoke all on function public.entregar_orden(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.anular_orden(uuid, text) from public, anon, authenticated;
grant execute on function public.crear_orden(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.cambiar_estado_orden(uuid, text) to authenticated;
grant execute on function public.entregar_orden(uuid, text, text, text) to authenticated;
grant execute on function public.anular_orden(uuid, text) to authenticated;
