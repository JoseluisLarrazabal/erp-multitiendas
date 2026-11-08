-- Hallazgos de base de la auditoría de la Entrega A (docs/auditoria-entrega-a.md; CTO, 2026-11-08: arreglar todos los
-- hallazgos). Solo create or replace con la misma firma: nada de sobrecargas. Códigos nuevos: ERP_SERIE_CON_STOCK,
-- ERP_ULTIMO_DUENO (este último lo lanza el trigger que sincroniza el baneo, no una RPC).
--  A2  registrar_venta y registrar_movimiento_caja con p_offline: lo hecho en una sesión que otro usuario cerró se acepta
--      y queda marcado 'caja_cerrada' solo si abierta_en <= hora <= cerrada_en y el cierre es de hace menos de 30 días
--      (una hora inventada no entra); si no, ERP_CAJA_CERRADA. La sesión cerrada no se muta. En línea sigue rechazando.
--      Reversa: anular_venta deja anular una venta 'caja_cerrada' de sesión cerrada a quien tiene `anular` y
--      `ver_reportes`: devuelve el stock y no toca efectivo (la sesión ya cerró con otro esperado).
--  M3  el vendedor y el empleado pierden `anular` (P-11). Efecto: tampoco devuelven dentro de las 24 h (devolver_venta
--      usa `anular`) ni anulan órdenes.
--  M4  resumen_caja sin `ver_reportes` devuelve en null ventas_efectivo, ingresos, gastos, retiros, devoluciones_efectivo,
--      esperado y qr_neto (queda monto_inicial). Residual aceptado: por RLS todo miembro sigue leyendo las filas de ventas,
--      movimientos y devoluciones (el POS las necesita), así que el arqueo ciego no es hermético en la base.
--  M5  abrir_caja y registrar_movimiento_caja con p_offline pasan por validar_offline_caja: un no miembro es
--      ERP_SIN_PERMISO; un miembro que ya no tiene `caja` (o está desactivado) o con hora de hace más de 30 días se ACEPTA
--      (dato perdido = dinero sin registro), con la hora limitada a hoy - 30 días, y queda marcado 'usuario_sin_permiso' /
--      'fecha_fuera_de_rango' en motivos_revision (caja_sesiones y caja_movimientos). Gasto o retiro offline sobre el
--      efectivo esperado: 'efectivo_insuficiente'. cerrar_caja no tiene p_offline: nada que acotar.
--      Revisión: caja_revisiones (append-only, una fila por ítem), revisar_caja(tipo, id) y reconciliacion_caja(negocio),
--      con `ver_reportes`. Tabla aparte porque caja_movimientos y las sesiones cerradas son inmutables por trigger.
--  Bajos: permiso antes del lock en las 3 RPC de órdenes; bloqueos por uuid en registrar_venta, guardar_precios,
--  registrar_conteo y fijar_costos (el mismo orden de bloquear_stock); devolver_venta no reparte sobre un QR rechazado
--  (nunca entró; efectivo_esperado y total_qr_sesion ya lo ignoran): si lo pedido supera efectivo + QR no rechazado,
--  ERP_QR_RECHAZADO; guardar_producto rechaza controla_serie false a true con stock distinto de cero
--  (ERP_SERIE_CON_STOCK); anular_venta rechaza una orden entregada (ERP_ORDEN_ENTREGADA, después del retorno idempotente
--  de "ya anulada"); stock con trigger de TRUNCATE; dos dueños no pueden desactivarse a la vez (el trigger de baneo
--  bloquea el negocio, igual que asignar_usuario y quitar_usuario, y exige otro dueño activo).
-- Verificado sin cambios: mis_negocios() (20261101120000_tenencia.sql:85) y tiene_permiso_de() (20261101210100:41, base de
-- tiene_permiso) filtran perfiles.activo, así que desactivar una cuenta corta su JWT vivo en la base.

alter table public.ventas drop constraint ventas_motivos_revision_check;
alter table public.ventas add constraint ventas_motivos_revision_check
  check (motivos_revision <@ array['producto_inactivo', 'sin_precio', 'descuento_sin_permiso', 'sobre_tope', 'renumerada',
    'otra_cuenta', 'sin_cliente', 'caja_cerrada']);

-- Marcas de revisión de un movimiento de caja enviado sin conexión (solo se ven en el detalle de la caja).
alter table public.caja_movimientos
  add column motivos_revision text[] not null default '{}'
    check (motivos_revision <@ array['caja_cerrada', 'efectivo_insuficiente', 'usuario_sin_permiso', 'fecha_fuera_de_rango']);
alter table public.caja_sesiones
  add column motivos_revision text[] not null default '{}'
    check (motivos_revision <@ array['usuario_sin_permiso', 'fecha_fuera_de_rango']);

-- Revisión de lo marcado en la caja. Tabla aparte: caja_movimientos es append-only y la sesión cerrada no cambia.
create table public.caja_revisiones (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id),
  tipo text not null check (tipo in ('apertura', 'movimiento')),
  ref_id uuid not null,
  revisado_por uuid not null references public.perfiles (id),
  revisado_en timestamptz not null default now(),
  unique (tipo, ref_id)
);
create index caja_revisiones_negocio_idx on public.caja_revisiones (negocio_id);
create trigger caja_revisiones_solo_agregar
  before update or delete on public.caja_revisiones
  for each row execute function public.rechazar_modificacion();
create trigger caja_revisiones_sin_truncate
  before truncate on public.caja_revisiones
  for each statement execute function public.rechazar_modificacion();
alter table public.caja_revisiones enable row level security;
create policy caja_revisiones_select on public.caja_revisiones for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
revoke all on public.caja_revisiones from anon, authenticated, public;
grant select on public.caja_revisiones to authenticated;

-- Privado. Validación común de lo enviado sin conexión a la caja: un no miembro se rechaza; a un miembro (aunque ya no
-- tenga `caja`) se le acepta lo hecho y se marca; la hora vieja se limita a hoy - 30 días y se marca.
create function public.validar_offline_caja(p_hora timestamptz, p_usuario uuid, p_negocio_id uuid)
returns table (hora_ajustada timestamptz, marcas text[])
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.usuario_en_negocio(p_usuario, p_negocio_id) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  hora_ajustada := p_hora;
  marcas := '{}';
  if not public.tiene_permiso_de(p_usuario, p_negocio_id, 'caja') then
    marcas := marcas || 'usuario_sin_permiso'::text;
  end if;
  if p_hora < now() - interval '30 days' then
    hora_ajustada := now() - interval '30 days';
    marcas := marcas || 'fecha_fuera_de_rango'::text;
  end if;
  return next;
end;
$$;
revoke all on function public.validar_offline_caja(timestamptz, uuid, uuid) from public, anon, authenticated;

-- Aperturas y movimientos enviados sin conexión con marcas sin revisar. Exige `ver_reportes`. Más reciente primero.
create function public.reconciliacion_caja(p_negocio_id uuid, p_limite integer default 100)
returns table (
  tipo text, id uuid, sesion_id uuid, hora timestamptz, usuario_id uuid, usuario_nombre text, enviada_por uuid,
  enviada_por_nombre text, detalle text, monto numeric, motivos text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.tiene_permiso(p_negocio_id, 'ver_reportes') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 500 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  return query
    select * from (
      select 'apertura'::text, s.id, s.id, s.abierta_en, s.usuario_apertura, pu.nombre, s.enviada_por, pe.nombre,
        'Apertura de caja · ' || d.nombre, s.monto_inicial, s.motivos_revision
      from public.caja_sesiones s
      join public.dispositivos d on d.id = s.dispositivo_id
      left join public.perfiles pu on pu.id = s.usuario_apertura
      left join public.perfiles pe on pe.id = s.enviada_por
      where s.negocio_id = p_negocio_id and cardinality(s.motivos_revision) > 0
        and not exists (select 1 from public.caja_revisiones r where r.tipo = 'apertura' and r.ref_id = s.id)
      union all
      select 'movimiento'::text, m.id, m.sesion_id, m.created_at, m.usuario_id, pu.nombre, m.enviada_por, pe.nombre,
        initcap(m.tipo) || ' · ' || m.motivo, m.monto, m.motivos_revision
      from public.caja_movimientos m
      left join public.perfiles pu on pu.id = m.usuario_id
      left join public.perfiles pe on pe.id = m.enviada_por
      where m.negocio_id = p_negocio_id and cardinality(m.motivos_revision) > 0
        and not exists (select 1 from public.caja_revisiones r where r.tipo = 'movimiento' and r.ref_id = m.id)
    ) q
    order by 4 desc, 2
    limit p_limite;
end;
$$;

-- Marca como revisada una apertura o un movimiento con marcas. Exige `ver_reportes`; repetir devuelve igual.
create function public.revisar_caja(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_negocio uuid;
  v_marcas text[];
  v_rev public.caja_revisiones;
begin
  if p_tipo = 'apertura' then
    select negocio_id, motivos_revision into v_negocio, v_marcas from public.caja_sesiones where id = p_id;
  elsif p_tipo = 'movimiento' then
    select negocio_id, motivos_revision into v_negocio, v_marcas from public.caja_movimientos where id = p_id;
  else
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_negocio is null or not public.tiene_permiso(v_negocio, 'ver_reportes') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if cardinality(v_marcas) = 0 then
    raise exception 'ERP_DATOS_INVALIDOS'; -- sin marcas no hay nada que revisar
  end if;
  insert into public.caja_revisiones (negocio_id, tipo, ref_id, revisado_por) values (v_negocio, p_tipo, p_id, v_uid)
  on conflict (tipo, ref_id) do nothing;
  select * into v_rev from public.caja_revisiones where tipo = p_tipo and ref_id = p_id;
  return jsonb_build_object('tipo', p_tipo, 'id', p_id, 'revisado_por', v_rev.revisado_por, 'revisado_en', v_rev.revisado_en);
end;
$$;
revoke all on function public.reconciliacion_caja(uuid, integer) from public, anon, authenticated;
revoke all on function public.revisar_caja(text, uuid) from public, anon, authenticated;
grant execute on function public.reconciliacion_caja(uuid, integer) to authenticated;
grant execute on function public.revisar_caja(text, uuid) to authenticated;

delete from public.rol_permisos where permiso = 'anular' and rol in ('vendedor', 'empleado');

create trigger stock_sin_truncate
  before truncate on public.stock
  for each statement execute function public.rechazar_modificacion();

-- Desactivar una cuenta (baneo en Auth) no puede dejar sin dueño activo a ningún negocio suyo. Dentro de la misma
-- transacción del baneo y bajo el lock del negocio: dos dueños que se desactivan a la vez se serializan y el segundo falla.
create or replace function public.sincronizar_activo_de_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activo boolean := new.banned_until is null or new.banned_until <= now();
  v_negocio uuid;
begin
  if not v_activo and exists (select 1 from public.perfiles where id = new.id and activo) then
    for v_negocio in
      select negocio_id from public.usuario_negocio where usuario_id = new.id and rol = 'dueno' order by negocio_id
    loop
      perform 1 from public.negocios where id = v_negocio for update;
      if not exists (
        select 1 from public.usuario_negocio un join public.perfiles p on p.id = un.usuario_id
        where un.negocio_id = v_negocio and un.rol = 'dueno' and un.usuario_id <> new.id and p.activo
      ) then
        raise exception 'ERP_ULTIMO_DUENO';
      end if;
    end loop;
  end if;
  update public.perfiles set activo = v_activo where id = new.id;
  return new;
end;
$$;

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
  if exists (select 1 from public.ordenes where id = p_venta_id and estado = 'entregada') then
    raise exception 'ERP_ORDEN_ENTREGADA'; -- la ropa ya salió: se devuelve, no se anula
  end if;
  if now() - v_venta.recibida_en > interval '24 hours'
     and not public.tiene_permiso(v_venta.negocio_id, 'devolver_fuera_plazo') then -- RN-08
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_sesion.cerrada_en is not null
     and not ('caja_cerrada' = any (v_venta.motivos_revision) and public.tiene_permiso(v_venta.negocio_id, 'ver_reportes')) then
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
    raise exception 'ERP_QR_RECHAZADO';
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

create or replace function public.cambiar_estado_orden(p_orden_id uuid, p_estado text)
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
  select * into v_ord from public.ordenes where id = p_orden_id;
  if not found or not public.tiene_permiso(v_ord.negocio_id, 'cambiar_estado_orden') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  select * into v_ord from public.ordenes where id = p_orden_id for update;
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

create or replace function public.entregar_orden(p_orden_id uuid, p_retirada_por text, p_retiro_con text, p_documento text default null)
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
  select * into v_ord from public.ordenes where id = p_orden_id;
  if not found or not public.tiene_permiso(v_ord.negocio_id, 'cambiar_estado_orden') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  select * into v_ord from public.ordenes where id = p_orden_id for update;
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

create or replace function public.anular_orden(p_orden_id uuid, p_motivo text)
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
  if not found or not public.tiene_permiso(v_venta.negocio_id, 'anular') then
    raise exception 'ERP_SIN_PERMISO'; -- permiso antes de cualquier lock
  end if;
  select * into v_sesion from public.caja_sesiones where id = v_venta.caja_sesion_id for update;
  select * into v_ord from public.ordenes where id = p_orden_id for update;
  if not found then
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

create or replace function public.abrir_caja(
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
  v_motivos text[] := '{}';
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
    if v_off then -- no miembro: ERP_SIN_PERMISO; sin `caja` hoy o hora vieja: se acepta y se marca
      select h.hora_ajustada, h.marcas into v_hora, v_motivos from public.validar_offline_caja(v_hora, v_usuario, p_negocio_id) h;
    end if;
    -- El mismo id en otro equipo en paralelo: no inserta y relee la fila ganadora (que cae en REPETIDA).
    insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, abierta_en, monto_inicial, origen,
      enviada_por, motivos_revision)
    values (p_id, p_negocio_id, p_dispositivo_id, v_usuario, coalesce(v_hora, now()), p_monto_inicial,
      case when v_off then 'offline' else 'online' end, (select auth.uid()), v_motivos)
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

create or replace function public.registrar_movimiento_caja(
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
  v_motivos text[] := '{}';
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
    if v_off then -- no miembro: ERP_SIN_PERMISO; sin `caja` hoy o hora vieja: se acepta y se marca
      select h.hora_ajustada, h.marcas into v_hora, v_motivos from public.validar_offline_caja(v_hora, v_usuario, v_sesion.negocio_id) h;
    end if;
    -- A2: hecho dentro de la sesión (abierta_en a cerrada_en) y con cierre de hace menos de 30 días se acepta y se revisa.
    if v_sesion.cerrada_en is not null then
      if not v_off or v_hora > v_sesion.cerrada_en or v_hora < v_sesion.abierta_en
         or v_sesion.cerrada_en <= now() - interval '30 days' then
        raise exception 'ERP_CAJA_CERRADA';
      end if;
      v_motivos := v_motivos || 'caja_cerrada'::text;
    end if;
    if p_tipo in ('gasto', 'retiro') and p_monto > public.efectivo_esperado(p_sesion_id) then
      if not v_off then
        raise exception 'ERP_EFECTIVO_INSUFICIENTE';
      end if;
      v_motivos := v_motivos || 'efectivo_insuficiente'::text; -- el gasto ya ocurrió: se acepta y se revisa
    end if;
    -- Dos llamadas simultáneas con el mismo id: la segunda espera, no inserta y relee la fila de la primera.
    insert into public.caja_movimientos (id, negocio_id, sesion_id, tipo, monto, motivo, usuario_id, created_at, origen,
      enviada_por, motivos_revision)
    values (p_id, v_sesion.negocio_id, p_sesion_id, p_tipo, p_monto, btrim(p_motivo), v_usuario,
      case when v_off then greatest(v_hora, v_sesion.abierta_en) else now() end,
      case when v_off then 'offline' else 'online' end, (select auth.uid()), v_motivos)
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
      'devoluciones_efectivo', null, 'esperado', null, 'qr_neto', null);
  end if;
  return v_res;
end;
$$;

create or replace function public.guardar_producto(p_negocio_id uuid, p_datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo_negocio text;
  v_id uuid;
  v_codigo text;
  v_barras text;
  v_nombre text;
  v_tipo text;
  v_foto text;
  v_constraint text;
  v_actual public.productos;
begin
  if not public.tiene_permiso(p_negocio_id, 'editar_productos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  select tipo into v_tipo_negocio from public.negocios where id = p_negocio_id;
  v_id := nullif(p_datos ->> 'id', '')::uuid;
  v_codigo := btrim(p_datos ->> 'codigo');
  v_barras := nullif(btrim(p_datos ->> 'codigo_barras'), '');
  v_nombre := btrim(p_datos ->> 'nombre');
  v_tipo := p_datos ->> 'tipo';
  v_foto := nullif(p_datos ->> 'foto_path', '');

  if v_codigo is null or v_codigo = '' or v_nombre is null or v_nombre = ''
     or v_tipo is null
     or not (v_tipo = any (case v_tipo_negocio when 'lavanderia' then array['servicio', 'insumo'] else array['producto'] end))
     -- La foto es <negocio_id>/<uuid>.(jpg|png|webp): sin subcarpetas ni '..'.
     or (v_foto is not null and v_foto !~ ('^' || p_negocio_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if v_id is null then
    insert into public.productos (
      negocio_id, codigo, codigo_barras, nombre, marca, modelo, categoria_id, tipo, unidad,
      controla_serie, garantia_meses, stock_minimo, foto_path, peso_paquete_kg
    ) values (
      p_negocio_id, v_codigo, v_barras, v_nombre, nullif(btrim(p_datos ->> 'marca'), ''),
      nullif(btrim(p_datos ->> 'modelo'), ''), (p_datos ->> 'categoria_id')::uuid, v_tipo,
      coalesce(p_datos ->> 'unidad', 'unidad'), coalesce((p_datos ->> 'controla_serie')::boolean, false),
      (p_datos ->> 'garantia_meses')::integer, (p_datos ->> 'stock_minimo')::numeric, v_foto,
      (p_datos ->> 'peso_paquete_kg')::numeric
    ) returning id into v_id;
  else
    select * into v_actual from public.productos where id = v_id and negocio_id = p_negocio_id for update;
    if found and exists (select 1 from public.movimientos_inventario where producto_id = v_id)
       and (v_actual.tipo is distinct from v_tipo
            or v_actual.unidad is distinct from coalesce(p_datos ->> 'unidad', 'unidad')
            or (v_actual.controla_serie and not coalesce((p_datos ->> 'controla_serie')::boolean, false))) then
      raise exception 'ERP_PRODUCTO_CON_MOVIMIENTOS';
    end if;
    -- Con stock sin series el producto quedaría invendible: primero se vende o se ajusta a cero.
    if found and not v_actual.controla_serie and coalesce((p_datos ->> 'controla_serie')::boolean, false)
       and exists (select 1 from public.stock where producto_id = v_id and cantidad <> 0) then
      raise exception 'ERP_SERIE_CON_STOCK';
    end if;
    update public.productos set
      codigo = v_codigo,
      codigo_barras = v_barras,
      nombre = v_nombre,
      marca = nullif(btrim(p_datos ->> 'marca'), ''),
      modelo = nullif(btrim(p_datos ->> 'modelo'), ''),
      categoria_id = (p_datos ->> 'categoria_id')::uuid,
      tipo = v_tipo,
      unidad = coalesce(p_datos ->> 'unidad', 'unidad'),
      controla_serie = coalesce((p_datos ->> 'controla_serie')::boolean, false),
      garantia_meses = (p_datos ->> 'garantia_meses')::integer,
      stock_minimo = (p_datos ->> 'stock_minimo')::numeric,
      peso_paquete_kg = case
        when p_datos ? 'peso_paquete_kg' then (p_datos ->> 'peso_paquete_kg')::numeric
        when coalesce(p_datos ->> 'unidad', 'unidad') = 'kg' then null
        else peso_paquete_kg end,
      foto_path = case when p_datos ? 'foto_path' then v_foto else foto_path end
    where id = v_id and negocio_id = p_negocio_id;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end if;
  return v_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    raise exception '%', case v_constraint when 'productos_codigo_uq' then 'ERP_CODIGO_DUPLICADO' else 'ERP_CODIGO_BARRAS_DUPLICADO' end;
  -- Cast de uuid, número o booleano mal formado, check de tabla, FK a una categoría de otro negocio.
  when invalid_text_representation or check_violation or foreign_key_violation or numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

create or replace function public.guardar_precios(p_negocio_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo_negocio text;
  v_listas text[];
  v_item jsonb;
  v_producto_id uuid;
  v_moneda text;
  v_monto numeric;
  v_precio record;
begin
  if not public.tiene_permiso(p_negocio_id, 'editar_productos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;

  select tipo into v_tipo_negocio from public.negocios where id = p_negocio_id;
  v_listas := case v_tipo_negocio
    when 'lavanderia' then array['normal', 'express']
    else array['contado', 'credito', 'mayorista', 'minimo']
  end;

  -- Orden fijo por producto: dos lotes concurrentes no se bloquean en cruz.
  for v_item in select e from jsonb_array_elements(p_items) e order by (e ->> 'producto_id')::uuid loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'precios') is distinct from 'object' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_moneda := v_item ->> 'moneda';
    if v_moneda is null or v_moneda not in ('BOB', 'USD')
       or v_producto_id is null then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    -- Bloquea el producto: no se desactiva ni cambia de moneda a medio lote.
    perform 1 from public.productos where id = v_producto_id and negocio_id = p_negocio_id for update;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;

    for v_precio in select key as lista, value from jsonb_each(v_item -> 'precios') loop
      if not (v_precio.lista = any (v_listas)) then
        raise exception 'ERP_DATOS_INVALIDOS';
      end if;
      if jsonb_typeof(v_precio.value) = 'null' then
        delete from public.producto_precios where producto_id = v_producto_id and lista = v_precio.lista;
      elsif jsonb_typeof(v_precio.value) = 'number' and (v_precio.value #>> '{}')::numeric > 0 then
        insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda)
        values (p_negocio_id, v_producto_id, v_precio.lista, (v_precio.value #>> '{}')::numeric, v_moneda)
        on conflict (producto_id, lista) do update
          set monto = excluded.monto, moneda = excluded.moneda, updated_at = now()
          -- Guardar lo mismo no toca la fila: no deja ruido en la auditoría.
          where (producto_precios.monto, producto_precios.moneda) is distinct from (excluded.monto, excluded.moneda);
      else
        raise exception 'ERP_DATOS_INVALIDOS';
      end if;
    end loop;

    -- Una lista que el item no tocó puede conservar otra moneda: el producto queda con una sola.
    if exists (select 1 from public.producto_precios where producto_id = v_producto_id and moneda <> v_moneda) then
      raise exception 'ERP_MONEDA_MIXTA';
    end if;
  end loop;

  return jsonb_array_length(p_items);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

create or replace function public.registrar_conteo(
  p_operacion_id uuid, p_negocio_id uuid, p_ubicacion_id uuid, p_items jsonb, p_motivo text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conteo_id uuid;
  v_producto public.productos;
  v_item jsonb;
  v_producto_id uuid;
  v_contada numeric;
  v_sistema numeric;
  v_costo numeric;
  v_diferencia numeric;
  v_serie_ids uuid[];
  v_ajustes integer := 0;
begin
  if not public.tiene_permiso(p_negocio_id, 'ajustar_inventario') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_operacion_id is null or p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if jsonb_array_length(p_items) > 500 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;
  if not exists (select 1 from public.ubicaciones where id = p_ubicacion_id and negocio_id = p_negocio_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if not public.reclamar_operacion(p_operacion_id, p_negocio_id, md5(jsonb_build_array(
       'conteo', p_negocio_id, p_ubicacion_id, p_items, p_motivo)::text)) then
    return (select count(*)::integer from public.movimientos_inventario where ref_id = p_operacion_id and ref_tipo = 'conteo');
  end if;

  insert into public.conteos (id, negocio_id, ubicacion_id, usuario_id, motivo)
  values (p_operacion_id, p_negocio_id, p_ubicacion_id, (select auth.uid()), nullif(btrim(p_motivo), ''))
  returning id into v_conteo_id;

  -- Orden fijo por producto: dos conteos concurrentes no se bloquean en cruz.
  for v_item in select e from jsonb_array_elements(p_items) e order by (e ->> 'producto_id')::uuid loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'producto_id') is distinct from 'string'
       or jsonb_typeof(v_item -> 'cantidad_contada') is distinct from 'number' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_contada := (v_item ->> 'cantidad_contada')::numeric;
    if v_contada < 0 then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_producto := public.validar_inventario(p_negocio_id, v_producto_id, p_ubicacion_id, v_contada);

    -- Crea la fila si falta: el for update serializa también el primer conteo de ese producto.
    insert into public.stock (negocio_id, producto_id, ubicacion_id, cantidad)
    values (p_negocio_id, v_producto_id, p_ubicacion_id, 0)
    on conflict do nothing;
    select cantidad, costo_promedio into v_sistema, v_costo from public.stock
    where producto_id = v_producto_id and ubicacion_id = p_ubicacion_id for update;
    v_sistema := coalesce(v_sistema, 0);

    -- Un producto repetido en el lote viola la clave de conteo_items.
    insert into public.conteo_items (conteo_id, negocio_id, producto_id, cantidad_sistema, cantidad_contada)
    values (v_conteo_id, p_negocio_id, v_producto_id, v_sistema, v_contada);

    v_diferencia := v_contada - v_sistema;
    if v_diferencia <> 0 then
      v_serie_ids := null;
      if v_producto.controla_serie and v_diferencia < 0 then
        if jsonb_typeof(v_item -> 'serie_ids') is distinct from 'array' then
          raise exception 'ERP_DATOS_INVALIDOS';
        end if;
        select array_agg(x::uuid) into v_serie_ids from jsonb_array_elements_text(v_item -> 'serie_ids') x;
      end if;
      insert into public.movimientos_inventario (
        negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
      ) values (
        p_negocio_id, p_ubicacion_id, v_producto_id, 'ajuste', v_diferencia,
        case when v_diferencia < 0 then v_costo end, 'conteo', v_conteo_id, (select auth.uid()),
        coalesce(nullif(btrim(p_motivo), ''), 'Conteo de inventario')
      );
      if v_producto.controla_serie and v_diferencia < 0 then
        perform public.bloquear_series(p_negocio_id, v_producto_id, p_ubicacion_id, v_serie_ids, -v_diferencia);
        update public.series set estado = 'baja' where id = any (v_serie_ids);
      end if;
      v_ajustes := v_ajustes + 1;
    end if;
  end loop;
  return v_ajustes;
exception
  when invalid_text_representation or numeric_value_out_of_range or unique_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

create or replace function public.fijar_costos(p_negocio_id uuid, p_items jsonb, p_motivo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_producto_id uuid;
  v_costo numeric;
  v_ubicacion_id uuid;
  v_actual numeric;
  v_n integer := 0;
begin
  if not (public.tiene_permiso(p_negocio_id, 'ajustar_inventario') and public.tiene_permiso(p_negocio_id, 'ver_costos')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;

  for v_item in select e from jsonb_array_elements(p_items) e order by (e ->> 'producto_id')::uuid loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'producto_id') is distinct from 'string'
       or jsonb_typeof(v_item -> 'costo') is distinct from 'number' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_costo := (v_item ->> 'costo')::numeric;
    if v_costo < 0 or v_costo <> round(v_costo, 4)
       or not exists (select 1 from public.productos where id = v_producto_id and negocio_id = p_negocio_id and tipo <> 'servicio') then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;

    for v_ubicacion_id in select u.id from public.ubicaciones u where u.negocio_id = p_negocio_id order by u.id loop
      v_actual := null;
      select costo_promedio into v_actual from public.stock
      where producto_id = v_producto_id and ubicacion_id = v_ubicacion_id for update;
      if v_actual is distinct from v_costo then
        insert into public.movimientos_inventario (
          negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, usuario_id, motivo
        ) values (
          p_negocio_id, v_ubicacion_id, v_producto_id, 'ajuste_costo', 0, v_costo, 'costos',
          (select auth.uid()), nullif(btrim(p_motivo), '')
        );
        v_n := v_n + 1;
      end if;
    end loop;
  end loop;
  return v_n;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;
