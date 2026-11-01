-- Ventas (RF-VEN-01 a RF-VEN-08): ventas, items, pagos, devoluciones y catalogo_pos. Toda escritura pasa por RPC
-- (20261101190100): authenticated solo lee. Las filas nacen con el UUID del cliente (reenvío idempotente).
-- ventas cambia solo de completada a anulada (anular_venta); el resto es append-only.
-- venta_items.costo_unitario (foto del costo, RN-06) no tiene select para authenticated, como movimientos_inventario.

alter table public.dispositivos add column ultimo_numero integer not null default 0 check (ultimo_numero >= 0);

create table public.ventas (
  id uuid primary key,
  negocio_id uuid not null references public.negocios (id),
  ubicacion_id uuid not null,
  dispositivo_id uuid not null,
  caja_sesion_id uuid not null,
  -- prefijo del equipo + '-' + 6 dígitos (C1-000123).
  numero text not null check (numero ~ '^[A-Z][0-9]{1,2}-[0-9]{6}$'),
  vendedor_id uuid not null references public.perfiles (id),
  -- Quien envió la venta: puede no ser quien vendió (fase 3, sesión reiniciada).
  enviada_por uuid not null references public.perfiles (id),
  cliente_id uuid,
  origen text not null check (origen in ('online', 'offline')),
  creada_en_cliente timestamptz not null,
  recibida_en timestamptz not null default now(),
  -- Suma bruta de cantidad * precio por línea, antes de cualquier descuento.
  subtotal numeric(12,2) not null check (subtotal >= 0),
  -- Descuento de la venta (el de cada línea va en venta_items).
  descuento numeric(12,2) not null default 0 check (descuento >= 0),
  total numeric(12,2) not null check (total > 0),
  -- Tipo de cambio vigente al vender (foto, RN-02); null si el negocio aún no tiene ninguno.
  tipo_cambio numeric(10,4) check (tipo_cambio is null or tipo_cambio > 0),
  condicion text not null default 'contado' check (condicion in ('contado', 'credito')),
  estado text not null default 'completada' check (estado in ('completada', 'anulada')),
  anulada_en timestamptz,
  anulada_por uuid references public.perfiles (id),
  motivo_anulacion text,
  -- md5 del payload de registrar_venta: reenviar el mismo id con otros datos es ERP_OPERACION_REPETIDA.
  huella text not null,
  foreign key (negocio_id, ubicacion_id) references public.ubicaciones (negocio_id, id),
  foreign key (negocio_id, dispositivo_id) references public.dispositivos (negocio_id, id),
  foreign key (negocio_id, caja_sesion_id) references public.caja_sesiones (negocio_id, id),
  foreign key (negocio_id, cliente_id) references public.clientes (negocio_id, id),
  unique (negocio_id, id),
  constraint ventas_numero_uq unique (negocio_id, numero),
  constraint ventas_anulacion_ck check (
    (estado = 'completada' and anulada_en is null and anulada_por is null and motivo_anulacion is null)
    or (estado = 'anulada' and anulada_en is not null and anulada_por is not null and motivo_anulacion is not null)
  )
);
create index ventas_negocio_fecha_idx on public.ventas (negocio_id, recibida_en);
create index ventas_caja_idx on public.ventas (caja_sesion_id);

create table public.venta_items (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null,
  venta_id uuid not null,
  -- Posición en el payload (el insert va ordenado por producto).
  linea smallint not null check (linea > 0),
  producto_id uuid not null,
  serie_id uuid references public.series (id),
  lista text not null check (lista in ('contado', 'mayorista', 'minimo', 'normal', 'express')),
  cantidad numeric(12,3) not null check (cantidad > 0),
  -- El que vio el vendedor (RN-03); precio_lista_servidor es el de la lista al vender, para comparar.
  precio_unitario numeric(12,2) not null check (precio_unitario > 0),
  precio_lista_servidor numeric(12,2) not null check (precio_lista_servidor > 0),
  descuento numeric(12,2) not null default 0 check (descuento >= 0),
  -- round(cantidad * precio_unitario, 2) - descuento
  total_linea numeric(12,2) not null check (total_linea >= 0),
  -- Parte del descuento de la venta que toca a esta línea; las líneas suman el descuento de la venta.
  -- Lo cobrado por la línea es total_linea - descuento_venta (base de la devolución).
  descuento_venta numeric(12,2) not null default 0 check (descuento_venta >= 0 and descuento_venta <= total_linea),
  costo_unitario numeric(12,4) check (costo_unitario is null or costo_unitario >= 0),
  foreign key (negocio_id, venta_id) references public.ventas (negocio_id, id),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id),
  unique (negocio_id, id),
  unique (venta_id, linea)
);
create index venta_items_producto_idx on public.venta_items (producto_id);
create index venta_items_serie_idx on public.venta_items (serie_id) where serie_id is not null;

create table public.venta_pagos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null,
  venta_id uuid not null,
  medio text not null check (medio in ('efectivo', 'qr')),
  monto numeric(12,2) not null check (monto > 0),
  verificacion text not null check (verificacion in ('no_aplica', 'pendiente', 'verificado')),
  foreign key (negocio_id, venta_id) references public.ventas (negocio_id, id),
  constraint venta_pagos_verificacion_ck check ((medio = 'efectivo') = (verificacion = 'no_aplica'))
);
create index venta_pagos_venta_idx on public.venta_pagos (venta_id);

-- id = UUID del cliente. El efectivo (monto_efectivo) sale de la caja_sesion_id del equipo que devuelve; el resto
-- (monto - monto_efectivo) vuelve por QR.
create table public.devoluciones (
  id uuid primary key,
  negocio_id uuid not null,
  venta_id uuid not null,
  dispositivo_id uuid not null,
  usuario_id uuid not null references public.perfiles (id),
  motivo text not null check (btrim(motivo) <> ''),
  monto numeric(12,2) not null check (monto >= 0),
  monto_efectivo numeric(12,2) not null check (monto_efectivo between 0 and monto),
  caja_sesion_id uuid not null,
  created_at timestamptz not null default now(),
  huella text not null,
  foreign key (negocio_id, venta_id) references public.ventas (negocio_id, id),
  foreign key (negocio_id, dispositivo_id) references public.dispositivos (negocio_id, id),
  foreign key (negocio_id, caja_sesion_id) references public.caja_sesiones (negocio_id, id),
  unique (negocio_id, id)
);
create index devoluciones_venta_idx on public.devoluciones (venta_id);
create index devoluciones_caja_idx on public.devoluciones (caja_sesion_id);

create table public.devolucion_items (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null,
  devolucion_id uuid not null,
  venta_item_id uuid not null,
  cantidad numeric(12,3) not null check (cantidad > 0),
  monto numeric(12,2) not null check (monto >= 0),
  foreign key (negocio_id, devolucion_id) references public.devoluciones (negocio_id, id),
  foreign key (negocio_id, venta_item_id) references public.venta_items (negocio_id, id),
  unique (devolucion_id, venta_item_id)
);
create index devolucion_items_item_idx on public.devolucion_items (venta_item_id);

-- Append-only (venta_items, venta_pagos, devoluciones, devolucion_items)
create trigger venta_items_solo_agregar before update or delete on public.venta_items
  for each row execute function public.rechazar_modificacion();
create trigger venta_items_sin_truncate before truncate on public.venta_items
  for each statement execute function public.rechazar_modificacion();
create trigger venta_pagos_solo_agregar before update or delete on public.venta_pagos
  for each row execute function public.rechazar_modificacion();
create trigger venta_pagos_sin_truncate before truncate on public.venta_pagos
  for each statement execute function public.rechazar_modificacion();
create trigger devoluciones_solo_agregar before update or delete on public.devoluciones
  for each row execute function public.rechazar_modificacion();
create trigger devoluciones_sin_truncate before truncate on public.devoluciones
  for each statement execute function public.rechazar_modificacion();
create trigger devolucion_items_solo_agregar before update or delete on public.devolucion_items
  for each row execute function public.rechazar_modificacion();
create trigger devolucion_items_sin_truncate before truncate on public.devolucion_items
  for each statement execute function public.rechazar_modificacion();

-- La venta no se borra; solo pasa de completada a anulada y nada más cambia (anular_venta).
create function public.venta_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.estado <> 'completada' or new.estado <> 'anulada'
     or (to_jsonb(new) - 'estado' - 'anulada_en' - 'anulada_por' - 'motivo_anulacion')
        is distinct from (to_jsonb(old) - 'estado' - 'anulada_en' - 'anulada_por' - 'motivo_anulacion') then
    raise exception 'ERP_SOLO_AGREGAR';
  end if;
  return new;
end;
$$;
revoke all on function public.venta_inmutable() from public, anon, authenticated;

create trigger ventas_inmutable before update or delete on public.ventas
  for each row execute function public.venta_inmutable();
create trigger ventas_sin_truncate before truncate on public.ventas
  for each statement execute function public.rechazar_modificacion();

alter table public.ventas enable row level security;
alter table public.venta_items enable row level security;
alter table public.venta_pagos enable row level security;
alter table public.devoluciones enable row level security;
alter table public.devolucion_items enable row level security;

create policy ventas_select on public.ventas for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
create policy venta_items_select on public.venta_items for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
create policy venta_pagos_select on public.venta_pagos for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
create policy devoluciones_select on public.devoluciones for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
create policy devolucion_items_select on public.devolucion_items for select to authenticated
  using (negocio_id in (select public.mis_negocios()));

revoke all on public.ventas from anon, authenticated, public;
revoke all on public.venta_items from anon, authenticated, public;
revoke all on public.venta_pagos from anon, authenticated, public;
revoke all on public.devoluciones from anon, authenticated, public;
revoke all on public.devolucion_items from anon, authenticated, public;

-- Sin huella: es de la idempotencia, la web no la necesita.
grant select (id, negocio_id, ubicacion_id, dispositivo_id, caja_sesion_id, numero, vendedor_id, enviada_por, cliente_id,
  origen, creada_en_cliente, recibida_en, subtotal, descuento, total, tipo_cambio, condicion, estado, anulada_en,
  anulada_por, motivo_anulacion) on public.ventas to authenticated;
-- Sin costo_unitario: un select * falla con 42501; la ganancia saldrá por RPC (fase 5).
grant select (id, negocio_id, venta_id, linea, producto_id, serie_id, lista, cantidad, precio_unitario,
  precio_lista_servidor, descuento, total_linea, descuento_venta) on public.venta_items to authenticated;
grant select on public.venta_pagos to authenticated;
grant select (id, negocio_id, venta_id, dispositivo_id, usuario_id, motivo, monto, monto_efectivo, caja_sesion_id,
  created_at) on public.devoluciones to authenticated;
grant select on public.devolucion_items to authenticated;

-- Un producto vendido no cambia de naturaleza (mismas reglas que guardar_producto con movimientos): un servicio
-- vendido no deja movimientos, y pasarlo a insumo haría que anular la venta creara stock fantasma.
create function public.producto_vendido_inmutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.tipo is distinct from old.tipo or new.unidad is distinct from old.unidad
      or (old.controla_serie and not new.controla_serie))
     and exists (select 1 from public.venta_items where producto_id = old.id) then
    raise exception 'ERP_PRODUCTO_CON_MOVIMIENTOS';
  end if;
  return new;
end;
$$;
revoke all on function public.producto_vendido_inmutable() from public, anon, authenticated;

create trigger productos_vendido_inmutable before update on public.productos
  for each row execute function public.producto_vendido_inmutable();

-- Snapshot del catálogo para el POS. Exige `vender` en el negocio de la ubicación. Nunca costos.
-- precios: Bs por lista (null si falta o si es USD sin tipo de cambio); el POS no vende lo que no tiene `contado`.
-- stock_por_ubicacion: {ubicacion_id: cantidad} de todas las ubicaciones del negocio (RF-VEN-08).
-- version: md5 de lo devuelto, así que cambia con productos, precios, tipo de cambio y stock sin depender de relojes.
create function public.catalogo_pos(p_ubicacion_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_tc numeric;
  v_ubicaciones jsonb;
  v_productos jsonb;
  v_catalogo jsonb;
begin
  select negocio_id into v_negocio_id from public.ubicaciones where id = p_ubicacion_id;
  if v_negocio_id is null or not public.tiene_permiso(v_negocio_id, 'vender') then
    raise exception 'ERP_SIN_PERMISO';
  end if;

  select valor into v_tc from public.tipos_cambio where negocio_id = v_negocio_id order by vigente_desde desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by nombre, id), '[]'::jsonb)
  into v_ubicaciones from public.ubicaciones where negocio_id = v_negocio_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'codigo', p.codigo,
    'codigo_barras', p.codigo_barras,
    'nombre', p.nombre,
    'unidad', p.unidad,
    'tipo', p.tipo,
    'controla_serie', p.controla_serie,
    'garantia_meses', p.garantia_meses,
    'precios', jsonb_build_object(
      'contado', pr.contado, 'credito', pr.credito, 'mayorista', pr.mayorista,
      'minimo', pr.minimo, 'normal', pr.normal, 'express', pr.express),
    'stock_por_ubicacion', coalesce(st.por_ubicacion, '{}'::jsonb),
    'stock_total', coalesce(st.total, 0)
  ) order by p.nombre, p.id), '[]'::jsonb)
  into v_productos
  from public.productos p
  left join lateral (
    select
      max(monto_bs) filter (where lista = 'contado') as contado,
      max(monto_bs) filter (where lista = 'credito') as credito,
      max(monto_bs) filter (where lista = 'mayorista') as mayorista,
      max(monto_bs) filter (where lista = 'minimo') as minimo,
      max(monto_bs) filter (where lista = 'normal') as normal,
      max(monto_bs) filter (where lista = 'express') as express
    from public.producto_precios_bs where producto_id = p.id
  ) pr on true
  left join lateral (
    select sum(s.cantidad) as total, jsonb_object_agg(s.ubicacion_id, s.cantidad) as por_ubicacion
    from public.stock s where s.producto_id = p.id
  ) st on true
  where p.negocio_id = v_negocio_id and p.activo;

  v_catalogo := jsonb_build_object('tipo_cambio', v_tc, 'ubicaciones', v_ubicaciones, 'productos', v_productos);
  return v_catalogo || jsonb_build_object('version', md5(v_catalogo::text));
end;
$$;

revoke all on function public.catalogo_pos(uuid) from public, anon, authenticated;
grant execute on function public.catalogo_pos(uuid) to authenticated;
