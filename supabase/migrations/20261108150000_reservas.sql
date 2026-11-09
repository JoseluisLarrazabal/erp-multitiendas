-- Reservas con anticipo (fase 7, Entrega B, PR 3; RF-RES-01, RF-RES-02, RF-RES-03). Permiso `gestionar_reservas` (no existe
-- en lavandería, matriz) más `caja` en crear y cancelar: el anticipo entra y sale por el cajón de la sesión abierta.
-- Errores nuevos: ERP_RESERVA_NO_ACTIVA (completar o cancelar una reserva ya cerrada), ERP_VENTA_DE_RESERVA (anular o
-- devolver una venta que completó una reserva), ERP_REQUIERE_CONEXION (registrar_venta con reserva y p_offline).
-- Stock: crear_reserva escribe `reserva` (-cantidad, costo foto); completar escribe `reserva_liberada` (+) y `venta` (-)
-- con ref_id distintos (reserva y venta; índice único del kardex); cancelar escribe `reserva_liberada` (+). Series: un producto con serie no se reserva.
-- Caja: reserva_pagos lleva el anticipo (tipo `anticipo`) y la devolución (tipo `devolucion`, P-12: se devuelve por caja, mismo
-- medio y monto, en la sesión abierta de quien cancela). efectivo_esperado y total_qr_sesion suman los anticipos y restan
-- las devoluciones por medio; resumen_caja los expone. El pago `anticipo` de la venta no es efectivo de la sesión
-- (venta_pagos.medio = 'anticipo', sin verificación): el arqueo no lo cuenta dos veces.
-- Reservas solo en línea: ni crear ni cancelar tienen p_offline, y registrar_venta lo rechaza con reserva.
-- shortcut: un producto por reserva y la venta que la completa lleva solo ese ítem, sin descuentos, sin crédito; ampliar si
-- el cliente reserva varios productos.
-- Precio acordado: crear_reserva lo valida como una línea de registrar_venta (lista contado): bajo el mínimo exige `descontar`
-- y la brecha respeta negocios.tope_descuento (ERP_SIN_PERMISO, ERP_DESCUENTO_TOPE). La venta que completa la reserva ya no
-- re-valida el piso. Exige stock disponible >= cantidad (ERP_STOCK_INSUFICIENTE): la reserva no deja stock negativo.
-- Costo: al completar, reserva_liberada va sin costo (el stock restante conserva su promedio) y la línea de la venta usa como
-- costo_unitario la foto del movimiento `reserva`. Al cancelar, reserva_liberada reingresa con esa foto (re-promedia, como
-- devolucion_cliente).
-- Equipo: crear y cancelar validan que la sesión sea de ese dispositivo y esté abierta (como registrar_venta); la ubicación
-- de la reserva es la del equipo. cancelar_reserva es idempotente por p_operacion_id.

create table public.reservas (
  id uuid primary key,
  negocio_id uuid not null,
  cliente_id uuid not null,
  producto_id uuid not null,
  ubicacion_id uuid not null,
  cantidad numeric(12,3) not null check (cantidad > 0 and cantidad <> 'NaN'),
  precio_acordado numeric(12,2) not null check (precio_acordado > 0 and precio_acordado <> 'NaN'),
  estado text not null default 'activa' check (estado in ('activa', 'completada', 'cancelada')),
  venta_id uuid,
  usuario_id uuid,
  created_at timestamptz not null default now(),
  cerrada_en timestamptz,
  unique (negocio_id, id),
  foreign key (negocio_id, cliente_id) references public.clientes (negocio_id, id),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id),
  foreign key (negocio_id, ubicacion_id) references public.ubicaciones (negocio_id, id),
  foreign key (negocio_id, venta_id) references public.ventas (negocio_id, id),
  constraint reservas_estado_ck check ((estado = 'completada') = (venta_id is not null)
    and (estado = 'activa') = (cerrada_en is null))
);
create index reservas_negocio_estado_idx on public.reservas (negocio_id, estado, created_at desc);
create index reservas_cliente_idx on public.reservas (cliente_id);
create index reservas_producto_idx on public.reservas (producto_id);
create unique index reservas_venta_uq on public.reservas (venta_id) where venta_id is not null;

-- Un anticipo y, como mucho, una devolución por reserva (la segunda cancelación no puede devolver dos veces).
create table public.reserva_pagos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null,
  reserva_id uuid not null,
  monto numeric(12,2) not null check (monto > 0 and monto <> 'NaN'),
  medio text not null check (medio in ('efectivo', 'qr')),
  caja_sesion_id uuid not null,
  tipo text not null check (tipo in ('anticipo', 'devolucion')),
  usuario_id uuid,
  created_at timestamptz not null default now(),
  foreign key (negocio_id, reserva_id) references public.reservas (negocio_id, id),
  foreign key (negocio_id, caja_sesion_id) references public.caja_sesiones (negocio_id, id)
);
create unique index reserva_pagos_tipo_uq on public.reserva_pagos (reserva_id, tipo);
create index reserva_pagos_sesion_idx on public.reserva_pagos (caja_sesion_id);

-- reservas cambia de estado solo por RPC (sin grants de escritura): aquí solo se impide borrar. Los pagos son append-only.
create trigger reservas_sin_borrar
  before delete on public.reservas
  for each row execute function public.rechazar_modificacion();
create trigger reservas_sin_truncate
  before truncate on public.reservas
  for each statement execute function public.rechazar_modificacion();
create trigger reserva_pagos_solo_agregar
  before update or delete on public.reserva_pagos
  for each row execute function public.rechazar_modificacion();
create trigger reserva_pagos_sin_truncate
  before truncate on public.reserva_pagos
  for each statement execute function public.rechazar_modificacion();

alter table public.reservas enable row level security;
alter table public.reserva_pagos enable row level security;
create policy reservas_select on public.reservas
  for select to authenticated using (negocio_id in (select public.mis_negocios()));
create policy reserva_pagos_select on public.reserva_pagos
  for select to authenticated using (negocio_id in (select public.mis_negocios()));
-- Sin costos en estas tablas (el costo foto vive en el kardex): select de tabla, sin escritura.
revoke all on public.reservas from anon, authenticated, public;
revoke all on public.reserva_pagos from anon, authenticated, public;
grant select on public.reservas to authenticated;
grant select on public.reserva_pagos to authenticated;

-- Pago `anticipo` de una venta que completa una reserva: sin verificación, como el efectivo.
alter table public.venta_pagos
  drop constraint venta_pagos_medio_check,
  add constraint venta_pagos_medio_check check (medio in ('efectivo', 'qr', 'anticipo')),
  drop constraint venta_pagos_verificacion_ck,
  add constraint venta_pagos_verificacion_ck check ((medio in ('efectivo', 'anticipo')) = (verificacion = 'no_aplica'));

-- Mismas firmas que en 20261101190100 (efectivo_esperado) y 20261101210100 (total_qr_sesion), más los pagos de reserva.
-- Efectivo esperado: + anticipos en efectivo - devoluciones de reserva en efectivo. Privada.
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
    + coalesce((select sum(case p.tipo when 'anticipo' then p.monto else -p.monto end) from public.reserva_pagos p
                where p.caja_sesion_id = s.id and p.medio = 'efectivo'), 0)
  from public.caja_sesiones s where s.id = p_sesion_id
$$;

-- QR neto: + anticipos por QR - devoluciones de reserva por QR (misma firma y filtro de rechazados que antes).
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
    + coalesce((select sum(case p.tipo when 'anticipo' then p.monto else -p.monto end) from public.reserva_pagos p
                where p.caja_sesion_id = p_sesion_id and p.medio = 'qr'), 0)
$$;

-- p_reserva: id (UUID del cliente), dispositivo_id, caja_sesion_id (sesión abierta de ese equipo), cliente_id, producto_id, cantidad,
-- precio_acordado, anticipo (> 0 y <= cantidad x precio), medio (efectivo | qr). La ubicación es la del equipo.
-- Idempotente por id (reclamar_operacion + huella). Devuelve {id}.
create function public.crear_reserva(p_reserva jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_sesion_id uuid;
  v_dispositivo_id uuid;
  v_cliente_id uuid;
  v_producto_id uuid;
  v_cant numeric;
  v_precio numeric;
  v_anticipo numeric;
  v_medio text;
  v_sesion public.caja_sesiones;
  v_disp public.dispositivos;
  v_producto public.productos;
  v_costo numeric;
  v_stock numeric;
  v_srv numeric;
  v_ref numeric;
  v_bruto numeric;
  v_piso numeric;
  v_negocio public.negocios;
begin
  perform public.payload_claves(p_reserva, array['id', 'dispositivo_id', 'caja_sesion_id', 'cliente_id', 'producto_id',
    'cantidad', 'precio_acordado', 'anticipo', 'medio']);
  v_id := public.payload_uuid(p_reserva, 'id', false);
  v_dispositivo_id := public.payload_uuid(p_reserva, 'dispositivo_id', false);
  v_sesion_id := public.payload_uuid(p_reserva, 'caja_sesion_id', false);
  v_cliente_id := public.payload_uuid(p_reserva, 'cliente_id', false);
  v_producto_id := public.payload_uuid(p_reserva, 'producto_id', false);
  v_cant := public.payload_numero(p_reserva, 'cantidad', 3);
  v_precio := public.payload_numero(p_reserva, 'precio_acordado', 2);
  v_anticipo := public.payload_numero(p_reserva, 'anticipo', 2);
  v_medio := public.payload_texto(p_reserva, 'medio', 10);

  select * into v_sesion from public.caja_sesiones where id = v_sesion_id and dispositivo_id = v_dispositivo_id;
  if not found or not public.tiene_permiso(v_sesion.negocio_id, 'gestionar_reservas')
     or not public.tiene_permiso(v_sesion.negocio_id, 'caja') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_cant <= 0 or v_precio <= 0 or v_anticipo <= 0 or v_anticipo > round(v_cant * v_precio, 2)
     or v_medio not in ('efectivo', 'qr') then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if not public.reclamar_operacion(v_id, v_sesion.negocio_id, md5(p_reserva::text)) then
    return jsonb_build_object('id', v_id);
  end if;

  -- for update: serializa con el cierre y con otros movimientos de la sesión (mismo orden que cancelar: sesión, reserva, stock)
  select * into v_sesion from public.caja_sesiones where id = v_sesion_id for update;
  if v_sesion.cerrada_en is not null then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  select * into v_disp from public.dispositivos where id = v_dispositivo_id;
  if not exists (select 1 from public.clientes where id = v_cliente_id and negocio_id = v_sesion.negocio_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_producto := public.validar_inventario(v_sesion.negocio_id, v_producto_id, v_disp.ubicacion_id, v_cant);
  if not v_producto.activo or v_producto.controla_serie then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  -- Precio acordado como una línea de venta de lista contado (mismo piso y tope que registrar_venta).
  select * into v_negocio from public.negocios where id = v_sesion.negocio_id;
  v_srv := public.precio_bs(v_producto_id, 'contado');
  if v_srv is null or v_srv <= 0 then
    raise exception 'ERP_PRODUCTO_SIN_PRECIO';
  end if;
  v_ref := least(public.precio_bs(v_producto_id, 'minimo'), v_srv);
  v_bruto := round(v_cant * v_precio, 2);
  v_piso := round(v_cant * v_ref, 2);
  if v_precio < v_ref then
    if not public.tiene_permiso(v_sesion.negocio_id, 'descontar') then
      raise exception 'ERP_SIN_PERMISO';
    end if;
    if v_piso - v_bruto > v_piso * v_negocio.tope_descuento / 100 then
      raise exception 'ERP_DESCUENTO_TOPE';
    end if;
  end if;

  perform public.bloquear_stock(v_sesion.negocio_id, v_disp.ubicacion_id, array[v_producto_id]);
  select cantidad, costo_promedio into v_stock, v_costo from public.stock
  where producto_id = v_producto_id and ubicacion_id = v_disp.ubicacion_id;
  if coalesce(v_stock, 0) < v_cant then
    raise exception 'ERP_STOCK_INSUFICIENTE';
  end if;
  insert into public.reservas (id, negocio_id, cliente_id, producto_id, ubicacion_id, cantidad, precio_acordado, usuario_id)
  values (v_id, v_sesion.negocio_id, v_cliente_id, v_producto_id, v_disp.ubicacion_id, v_cant, v_precio, v_uid);
  insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario,
    ref_tipo, ref_id, usuario_id)
  values (v_sesion.negocio_id, v_disp.ubicacion_id, v_producto_id, 'reserva', -v_cant, v_costo, 'reserva', v_id, v_uid);
  insert into public.reserva_pagos (negocio_id, reserva_id, monto, medio, caja_sesion_id, tipo, usuario_id)
  values (v_sesion.negocio_id, v_id, v_anticipo, v_medio, v_sesion_id, 'anticipo', v_uid);
  return jsonb_build_object('id', v_id);
exception
  when numeric_value_out_of_range or invalid_text_representation or foreign_key_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- Cancela una reserva activa (idempotente por p_operacion_id): libera el stock y devuelve el anticipo por caja (P-12), mismo medio y monto, en la sesión
-- abierta p_sesion_id. Efectivo mayor que el esperado de esa sesión: ERP_EFECTIVO_INSUFICIENTE (DB-24).
-- Cancelar o completar una reserva que ya no está activa: ERP_RESERVA_NO_ACTIVA.
create function public.cancelar_reserva(p_operacion_id uuid, p_reserva_id uuid, p_sesion_id uuid, p_dispositivo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reserva public.reservas;
  v_sesion public.caja_sesiones;
  v_pago public.reserva_pagos;
  v_costo numeric;
begin
  select * into v_reserva from public.reservas where id = p_reserva_id;
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id and dispositivo_id = p_dispositivo_id;
  if p_operacion_id is null or p_reserva_id is null or p_sesion_id is null or v_reserva.id is null or v_sesion.id is null
     or v_reserva.negocio_id <> v_sesion.negocio_id
     or not public.tiene_permiso(v_reserva.negocio_id, 'gestionar_reservas')
     or not public.tiene_permiso(v_reserva.negocio_id, 'caja') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  -- Reintento de la misma operación: devuelve lo original (la reserva ya está cancelada).
  if not public.reclamar_operacion(p_operacion_id, v_reserva.negocio_id,
       md5(jsonb_build_array('cancelar_reserva', p_reserva_id, p_sesion_id, p_dispositivo_id)::text)) then
    return jsonb_build_object('id', p_reserva_id, 'estado', 'cancelada');
  end if;
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id for update;
  if v_sesion.cerrada_en is not null then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  select * into v_reserva from public.reservas where id = p_reserva_id for update;
  if v_reserva.estado <> 'activa' then
    raise exception 'ERP_RESERVA_NO_ACTIVA';
  end if;
  select * into v_pago from public.reserva_pagos where reserva_id = p_reserva_id and tipo = 'anticipo';
  if v_pago.medio = 'efectivo' and v_pago.monto > public.efectivo_esperado(p_sesion_id) then
    raise exception 'ERP_EFECTIVO_INSUFICIENTE';
  end if;

  perform public.bloquear_stock(v_reserva.negocio_id, v_reserva.ubicacion_id, array[v_reserva.producto_id]);
  select costo_unitario into v_costo from public.movimientos_inventario where ref_id = p_reserva_id and tipo = 'reserva';
  insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario,
    ref_tipo, ref_id, usuario_id)
  values (v_reserva.negocio_id, v_reserva.ubicacion_id, v_reserva.producto_id, 'reserva_liberada', v_reserva.cantidad,
    v_costo, 'reserva', p_reserva_id, v_uid);
  insert into public.reserva_pagos (negocio_id, reserva_id, monto, medio, caja_sesion_id, tipo, usuario_id)
  values (v_reserva.negocio_id, p_reserva_id, v_pago.monto, v_pago.medio, p_sesion_id, 'devolucion', v_uid);
  update public.reservas set estado = 'cancelada', cerrada_en = now() where id = p_reserva_id;
  return jsonb_build_object('id', p_reserva_id, 'estado', 'cancelada');
end;
$$;

-- Reservas activas del negocio, las más nuevas primero (tope 200). anticipo = lo recibido por caja.
create function public.reservas_activas(p_negocio_id uuid)
returns table (
  id uuid, cliente_id uuid, cliente_nombre text, producto_id uuid, producto_nombre text, ubicacion_id uuid,
  cantidad numeric, precio_acordado numeric, anticipo numeric, medio text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.tiene_permiso(p_negocio_id, 'gestionar_reservas') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  return query
    select r.id, r.cliente_id, c.nombre, r.producto_id, p.nombre, r.ubicacion_id, r.cantidad, r.precio_acordado,
           a.monto, a.medio, r.created_at
    from public.reservas r
    join public.clientes c on c.id = r.cliente_id
    join public.productos p on p.id = r.producto_id
    join public.reserva_pagos a on a.reserva_id = r.id and a.tipo = 'anticipo'
    where r.negocio_id = p_negocio_id and r.estado = 'activa'
    order by r.created_at desc
    limit 200;
end;
$$;

revoke all on function public.crear_reserva(jsonb) from public, anon, authenticated;
revoke all on function public.cancelar_reserva(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.reservas_activas(uuid) from public, anon, authenticated;
grant execute on function public.crear_reserva(jsonb) to authenticated;
grant execute on function public.cancelar_reserva(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.reservas_activas(uuid) to authenticated;

-- registrar_venta, anular_venta, devolver_venta y resumen_caja: la última definición (20261108130000), misma firma, solo con
-- lo de reservas (reserva_id y medio anticipo; ERP_VENTA_DE_RESERVA; anticipos y devoluciones en el arqueo).
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
  v_reserva public.reservas;
  v_reserva_id uuid;
  v_anticipo numeric := 0;
  v_n_anticipo integer;
  v_suma_anticipo numeric;
  v_costo_reserva numeric;
begin
  -- Forma del payload (sin tocar la base)
  perform public.payload_claves(p_venta, array['id', 'dispositivo_id', 'caja_sesion_id', 'numero', 'cliente_id',
    'creada_en_cliente', 'descuento', 'total', 'items', 'pagos', 'reserva_id']);
  v_id := public.payload_uuid(p_venta, 'id', false);
  v_dispositivo_id := public.payload_uuid(p_venta, 'dispositivo_id', false);
  v_caja_id := public.payload_uuid(p_venta, 'caja_sesion_id', false);
  v_cliente_id := public.payload_uuid(p_venta, 'cliente_id', true);
  v_reserva_id := public.payload_uuid(p_venta, 'reserva_id', true);
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
    if jsonb_typeof(v_e -> 'medio') is distinct from 'string' or v_e ->> 'medio' not in ('efectivo', 'qr', 'anticipo')
       or (v_e ->> 'medio' = 'anticipo' and v_reserva_id is null)
       or (v_e -> 'verificado' is not null and jsonb_typeof(v_e -> 'verificado') not in ('boolean', 'null'))
       -- QR: en línea llega confirmado; offline puede venir pendiente (false), pero siempre explícito
       or (v_e ->> 'medio' = 'qr' and case when v_off then jsonb_typeof(v_e -> 'verificado') is distinct from 'boolean'
                                            else v_e -> 'verificado' is distinct from 'true'::jsonb end) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end loop;
  if v_off and v_reserva_id is not null then
    raise exception 'ERP_REQUIERE_CONEXION'; -- una reserva nunca se encola: el reintento va a reconciliación
  end if;
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
  where id = v_caja_id and negocio_id = v_disp.negocio_id and dispositivo_id = v_dispositivo_id
  for share;
  if not found then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  -- A2: una venta offline hecha antes del cierre se acepta aunque otro usuario cerró la caja (el efectivo ya entró);
  -- la sesión cerrada no se toca y la venta queda para revisión. En línea, o hecha después del cierre, se rechaza.
  -- Solo si la hora cae dentro de la sesión y el cierre es de hace menos de 30 días: una hora inventada no entra.
  if v_sesion.cerrada_en is not null then
    if not v_off or v_creada > v_sesion.cerrada_en or v_creada < v_sesion.abierta_en
       or v_sesion.cerrada_en <= now() - interval '30 days' then
      raise exception 'ERP_CAJA_CERRADA';
    end if;
    v_motivos := v_motivos || 'caja_cerrada'::text;
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

  -- Completar una reserva (RF-RES-02): bloquea la fila, exige un solo ítem igual al reservado y sin descuentos.
  if v_reserva_id is not null then
    if not public.tiene_permiso(v_disp.negocio_id, 'gestionar_reservas') then
      raise exception 'ERP_SIN_PERMISO';
    end if;
    select * into v_reserva from public.reservas where id = v_reserva_id and negocio_id = v_disp.negocio_id for update;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    if v_reserva.estado <> 'activa' then
      raise exception 'ERP_RESERVA_NO_ACTIVA';
    end if;
    if v_reserva.cliente_id is distinct from v_cliente_id or v_reserva.ubicacion_id <> v_disp.ubicacion_id
       or jsonb_array_length(v_items) <> 1 or v_desc_venta <> 0 then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    select coalesce(sum(monto), 0) into v_anticipo from public.reserva_pagos
    where reserva_id = v_reserva_id and tipo = 'anticipo';
    select costo_unitario into v_costo_reserva from public.movimientos_inventario
    where ref_id = v_reserva_id and tipo = 'reserva';
  end if;

  -- Líneas, ordenadas por producto (mismo orden de bloqueo que trasladar_stock)
  for v_e, v_ord in
    select t.e, t.ord from jsonb_array_elements(v_items) with ordinality t (e, ord)
    order by (t.e ->> 'producto_id')::uuid, t.ord
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
    if v_reserva_id is not null and (v_producto.id <> v_reserva.producto_id or v_cant <> v_reserva.cantidad
       or v_precio <> v_reserva.precio_acordado or v_desc <> 0) then
      raise exception 'ERP_DATOS_INVALIDOS'; -- el precio validado es precio_acordado
    end if;
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
      if v_reserva_id is null then
        if not v_off then
          raise exception 'ERP_PRODUCTO_SIN_PRECIO';
        end if;
        v_motivos := v_motivos || 'sin_precio'::text;
      end if;
      v_srv := null;
    end if;
    -- Piso de la línea: el menor entre el mínimo y la lista elegida, para no castigar una lista publicada bajo el
    -- mínimo. Entre el piso y la lista se negocia sin permiso; bajo el piso exige `descontar` y la brecha cuenta como
    -- descuento y como base del tope (bajar el precio no achica la base).
    -- Sin lista no hay piso (least ignora nulos y dejaría al mínimo como piso de una lista que no existe).
    v_min := public.precio_bs(v_producto.id, 'minimo');
    v_ref := case when v_srv is null or v_reserva_id is not null then null else least(v_min, v_srv) end; -- reserva: sin piso, el precio ya se acordó
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
  -- Con reserva: un solo pago `anticipo` igual a los anticipos recibidos (no es efectivo de la sesión: no entra al arqueo).
  if v_reserva_id is not null then
    select count(*), coalesce(sum((e ->> 'monto')::numeric), 0) into v_n_anticipo, v_suma_anticipo
    from jsonb_array_elements(v_pagos) e where e ->> 'medio' = 'anticipo';
    if v_n_anticipo <> 1 or v_suma_anticipo <> v_anticipo then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
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
    if v_reserva_id is not null then
      v_costo := v_costo_reserva; -- costo foto de la reserva, no el promedio de hoy
    elsif not (v_e ->> 'servicio')::boolean then
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
    case when e ->> 'medio' in ('efectivo', 'anticipo') then 'no_aplica'
         when (e ->> 'verificado')::boolean then 'verificado' else 'pendiente' end
  from jsonb_array_elements(v_pagos) e;

  -- La reserva ya descontó el stock: se libera (+) y la venta lo descuenta (-), con ref_id distintos (índice único del
  -- kardex). Al completar la liberación va SIN costo (no re-pondera costo_promedio) y la línea de la venta usa la foto.
  if v_reserva_id is not null then
    insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario,
      ref_tipo, ref_id, usuario_id)
    values (v_disp.negocio_id, v_reserva.ubicacion_id, v_reserva.producto_id, 'reserva_liberada', v_reserva.cantidad,
      null, 'reserva', v_reserva_id, v_uid);
    update public.reservas set estado = 'completada', venta_id = v_id, cerrada_en = now() where id = v_reserva_id;
  end if;
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
  v_correccion boolean;
begin
  select * into v_venta from public.ventas where id = p_venta_id;
  if not found or not public.tiene_permiso(v_venta.negocio_id, 'anular') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if exists (select 1 from public.ordenes where id = p_venta_id and estado in ('recibida', 'en_lavado', 'lista')) then
    raise exception 'ERP_ES_ORDEN'; -- orden activa: se anula desde la orden (anular_orden); entregada/cancelada ya no
  end if;
  if exists (select 1 from public.reservas where venta_id = p_venta_id) then
    raise exception 'ERP_VENTA_DE_RESERVA'; -- el anticipo ya está en caja y el stock salió de la reserva: sin reverso automático
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
  if exists (select 1 from public.ordenes where id = p_venta_id and estado = 'entregada') then
    raise exception 'ERP_ORDEN_ENTREGADA'; -- la ropa ya salió: se devuelve, no se anula
  end if;
  -- Corrección de revisión (A2): venta caja_cerrada de sesión cerrada, por quien tiene `ver_reportes`; sin plazo de 24 h.
  v_correccion := v_sesion.cerrada_en is not null and 'caja_cerrada' = any (v_venta.motivos_revision)
    and public.tiene_permiso(v_venta.negocio_id, 'ver_reportes');
  if now() - v_venta.recibida_en > interval '24 hours' and not v_correccion
     and not public.tiene_permiso(v_venta.negocio_id, 'devolver_fuera_plazo') then -- RN-08
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_sesion.cerrada_en is not null and not v_correccion then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  if exists (select 1 from public.devoluciones where venta_id = p_venta_id) then
    raise exception 'ERP_VENTA_CON_DEVOLUCIONES';
  end if;
  if v_sesion.cerrada_en is null
     and (select coalesce(sum(monto), 0) from public.venta_pagos where venta_id = p_venta_id and medio = 'efectivo')
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
  if exists (select 1 from public.reservas where venta_id = v_venta.id) then
    raise exception 'ERP_VENTA_DE_RESERVA'; -- el anticipo ya está en caja y el stock salió de la reserva: sin reverso automático
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

  select coalesce(sum(monto) filter (where medio = 'efectivo'), 0), coalesce(sum(monto) filter (where medio = 'qr' and verificacion <> 'rechazado'), 0)
  into v_rest_ef, v_rest_qr from public.venta_pagos where venta_id = v_venta_id;
  v_rest_ef := v_rest_ef - (select coalesce(sum(monto_efectivo), 0) from public.devoluciones where venta_id = v_venta_id);
  v_rest_qr := v_rest_qr - (select coalesce(sum(monto - monto_efectivo), 0) from public.devoluciones
                            where venta_id = v_venta_id);
  -- Un QR rechazado nunca entró (efectivo_esperado y total_qr_sesion no lo cuentan): no se devuelve a ese pago.
  v_rest_qr := greatest(v_rest_qr, 0);
  if v_total > v_rest_ef + v_rest_qr then
    if exists (select 1 from public.venta_pagos where venta_id = v_venta_id and medio = 'qr' and verificacion = 'rechazado') then
      raise exception 'ERP_QR_RECHAZADO';
    end if;
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
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
  v_rev boolean;
begin
  select negocio_id into v_negocio_id from public.caja_sesiones where id = p_sesion_id;
  v_rev := coalesce(public.tiene_permiso(v_negocio_id, 'ver_reportes'), false);
  if v_negocio_id is null or not (v_rev or public.tiene_permiso(v_negocio_id, 'caja')) then
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
    'anticipos_efectivo', coalesce((select sum(p.monto) from public.reserva_pagos p
                                    where p.caja_sesion_id = s.id and p.tipo = 'anticipo' and p.medio = 'efectivo'), 0),
    'anticipos_qr', coalesce((select sum(p.monto) from public.reserva_pagos p
                              where p.caja_sesion_id = s.id and p.tipo = 'anticipo' and p.medio = 'qr'), 0),
    'devoluciones_reserva_efectivo', coalesce((select sum(p.monto) from public.reserva_pagos p
                                               where p.caja_sesion_id = s.id and p.tipo = 'devolucion' and p.medio = 'efectivo'), 0),
    'devoluciones_reserva_qr', coalesce((select sum(p.monto) from public.reserva_pagos p
                                         where p.caja_sesion_id = s.id and p.tipo = 'devolucion' and p.medio = 'qr'), 0),
    'esperado', public.efectivo_esperado(s.id),
    'qr_neto', public.total_qr_sesion(s.id),
    'qr_pendiente', coalesce((select sum(vp.monto) from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
                              where v.caja_sesion_id = s.id and v.estado = 'completada' and vp.medio = 'qr'
                                and vp.verificacion = 'pendiente'), 0),
    'cantidad_ventas', (select count(*) from public.ventas v where v.caja_sesion_id = s.id),
    'cantidad_movimientos', (select count(*) from public.caja_movimientos m where m.sesion_id = s.id)
  ) into v_res
  from public.caja_sesiones s where s.id = p_sesion_id;
  -- M4: sin `ver_reportes` van en null todos los términos del esperado (queda monto_inicial, que escribió el cajero).
  -- Residual aceptado: por RLS todo miembro sigue leyendo las filas de ventas, movimientos y devoluciones (el POS las usa).
  if not v_rev then
    v_res := v_res || jsonb_build_object('ventas_efectivo', null, 'ingresos', null, 'gastos', null, 'retiros', null,
      'devoluciones_efectivo', null, 'esperado', null, 'qr_neto', null,
      'anticipos_efectivo', null, 'anticipos_qr', null, 'devoluciones_reserva_efectivo', null, 'devoluciones_reserva_qr', null);
  end if;
  return v_res;
end;
$$;

-- reporte_caja (20261102140000), misma firma: más reservas_efectivo (anticipos menos devoluciones de reserva en efectivo)
-- para que las columnas sigan sumando al esperado.
create or replace function public.reporte_caja(p_negocio_id uuid, p_desde date, p_hasta date)
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
           (x ->> 'devoluciones_efectivo')::numeric as devoluciones_efectivo,
           (x ->> 'anticipos_efectivo')::numeric - (x ->> 'devoluciones_reserva_efectivo')::numeric as reservas_efectivo,
           (x ->> 'esperado')::numeric as esperado,
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
        'reservas_efectivo', r.reservas_efectivo, 'esperado', r.esperado, 'contado', r.contado, 'diferencia', r.diferencia)
      order by r.abierta_en, r.id), '[]'::jsonb) from r),
    (select count(*) from r),
    (select jsonb_build_object('sesiones', count(*), 'monto_inicial', coalesce(sum(r.monto_inicial), 0),
        'ventas_efectivo', coalesce(sum(r.ventas_efectivo), 0), 'ventas_qr', coalesce(sum(r.qr_neto), 0),
        'qr_pendiente', coalesce(sum(r.qr_pendiente), 0), 'ingresos', coalesce(sum(r.ingresos), 0),
        'egresos', coalesce(sum(r.egresos), 0), 'devoluciones_efectivo', coalesce(sum(r.devoluciones_efectivo), 0),
        'reservas_efectivo', coalesce(sum(r.reservas_efectivo), 0),
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
