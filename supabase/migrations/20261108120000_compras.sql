-- Proveedores y compras (fase 7, Entrega B, PR 1; RF-COM-01, RF-COM-02, RF-COM-03). Permiso `gestionar_compras` en toda RPC.
-- Errores: ERP_SIN_PERMISO, ERP_DATOS_INVALIDOS, ERP_OPERACION_REPETIDA, ERP_PAGO_EXCEDE_DEUDA (nuevo: pago mayor a la deuda).
-- Deuda de un proveedor = suma de sus compras - suma de sus pagos (decisión 5 del plan). Una compra al contado
-- registra en la misma transacción un pago por el total, así la deuda se calcula igual en los dos casos.
-- Los pagos a proveedor no pasan por la caja del POS (decisión 4): no llevan caja_sesion_id.
-- Costos: como en el kardex, authenticated no tiene select sobre compras.total, compra_items.costo_unitario ni
-- proveedor_pagos.monto (RLS filtra filas, no columnas). El total de las compras sale por totales_compras (ver_costos);
-- la deuda por deudas_proveedores (gestionar_compras: es lo que se le debe al proveedor, lo ve quien gestiona compras).
-- Idempotencia: id de la compra / del pago = UUID del cliente, reclamado en reclamar_operacion con la huella del payload.
-- Un producto repetido en los ítems se rechaza. No hay anulación de compra (se corrige con ajustar_inventario).
-- shortcut: pagar_proveedor valida contra la deuda del proveedor, no de la compra puntual; compra_id es solo referencia.
-- shortcut: proveedores sin unicidad de nombre; agregar si el cliente duplica proveedores.

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id),
  nombre text not null check (btrim(nombre) <> ''),
  contacto text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (negocio_id, id)
);
create trigger proveedores_updated_at
  before update on public.proveedores
  for each row execute function public.tocar_updated_at();

create table public.compras (
  id uuid primary key,
  negocio_id uuid not null,
  proveedor_id uuid not null,
  ubicacion_id uuid not null,
  total numeric(12,2) not null check (total >= 0 and total <> 'NaN'),
  condicion text not null check (condicion in ('contado', 'credito')),
  usuario_id uuid,
  created_at timestamptz not null default now(),
  unique (negocio_id, id),
  foreign key (negocio_id, proveedor_id) references public.proveedores (negocio_id, id),
  foreign key (negocio_id, ubicacion_id) references public.ubicaciones (negocio_id, id)
);
create index compras_proveedor_idx on public.compras (proveedor_id);
create index compras_negocio_creada_idx on public.compras (negocio_id, created_at desc);

create table public.compra_items (
  compra_id uuid not null,
  negocio_id uuid not null,
  producto_id uuid not null,
  cantidad numeric(12,3) not null check (cantidad > 0 and cantidad <> 'NaN'),
  costo_unitario numeric(12,4) not null check (costo_unitario >= 0 and costo_unitario <> 'NaN'),
  primary key (compra_id, producto_id),
  foreign key (negocio_id, compra_id) references public.compras (negocio_id, id),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id)
);

create table public.proveedor_pagos (
  id uuid primary key,
  negocio_id uuid not null,
  proveedor_id uuid not null,
  compra_id uuid,
  monto numeric(12,2) not null check (monto > 0 and monto <> 'NaN'),
  medio text not null check (medio in ('efectivo', 'qr', 'transferencia')),
  usuario_id uuid,
  created_at timestamptz not null default now(),
  foreign key (negocio_id, proveedor_id) references public.proveedores (negocio_id, id),
  -- Con compra_id nulo la FK no aplica (MATCH SIMPLE).
  foreign key (negocio_id, compra_id) references public.compras (negocio_id, id)
);
create index proveedor_pagos_proveedor_idx on public.proveedor_pagos (proveedor_id);

create trigger compras_solo_agregar
  before update or delete on public.compras
  for each row execute function public.rechazar_modificacion();
create trigger compras_sin_truncate
  before truncate on public.compras
  for each statement execute function public.rechazar_modificacion();
create trigger compra_items_solo_agregar
  before update or delete on public.compra_items
  for each row execute function public.rechazar_modificacion();
create trigger compra_items_sin_truncate
  before truncate on public.compra_items
  for each statement execute function public.rechazar_modificacion();
create trigger proveedor_pagos_solo_agregar
  before update or delete on public.proveedor_pagos
  for each row execute function public.rechazar_modificacion();
create trigger proveedor_pagos_sin_truncate
  before truncate on public.proveedor_pagos
  for each statement execute function public.rechazar_modificacion();

alter table public.proveedores enable row level security;
alter table public.compras enable row level security;
alter table public.compra_items enable row level security;
alter table public.proveedor_pagos enable row level security;

create policy proveedores_select on public.proveedores
  for select to authenticated using (negocio_id in (select public.mis_negocios()));
create policy compras_select on public.compras
  for select to authenticated using (negocio_id in (select public.mis_negocios()));
create policy compra_items_select on public.compra_items
  for select to authenticated using (negocio_id in (select public.mis_negocios()));
create policy proveedor_pagos_select on public.proveedor_pagos
  for select to authenticated using (negocio_id in (select public.mis_negocios()));

revoke all on public.proveedores from anon, authenticated, public;
revoke all on public.compras from anon, authenticated, public;
revoke all on public.compra_items from anon, authenticated, public;
revoke all on public.proveedor_pagos from anon, authenticated, public;
grant select on public.proveedores to authenticated;
grant select (id, negocio_id, proveedor_id, ubicacion_id, condicion, usuario_id, created_at)
  on public.compras to authenticated;
grant select (compra_id, negocio_id, producto_id, cantidad) on public.compra_items to authenticated;
grant select (id, negocio_id, proveedor_id, compra_id, medio, usuario_id, created_at)
  on public.proveedor_pagos to authenticated;

-- Sin id crea; con id edita y reemplaza nombre, contacto y activo. p_datos: id, nombre (obligatorio), contacto, activo.
create function public.guardar_proveedor(p_negocio_id uuid, p_datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_nombre text;
  v_contacto text;
  v_activo boolean;
begin
  if not public.tiene_permiso(p_negocio_id, 'gestionar_compras') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  perform public.payload_claves(p_datos, array['id', 'nombre', 'contacto', 'activo']);
  v_id := public.payload_uuid(p_datos, 'id', true);
  v_nombre := public.payload_texto(p_datos, 'nombre', 200);
  if jsonb_typeof(p_datos -> 'contacto') not in ('string', 'null') and p_datos ? 'contacto' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_contacto := nullif(btrim(p_datos ->> 'contacto'), '');
  if length(v_contacto) > 300 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if p_datos ? 'activo' then
    if jsonb_typeof(p_datos -> 'activo') <> 'boolean' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_activo := (p_datos ->> 'activo')::boolean;
  else
    v_activo := true;
  end if;

  if v_id is null then
    insert into public.proveedores (negocio_id, nombre, contacto, activo)
    values (p_negocio_id, v_nombre, v_contacto, v_activo)
    returning id into v_id;
  else
    update public.proveedores set nombre = v_nombre, contacto = v_contacto, activo = v_activo
    where id = v_id and negocio_id = p_negocio_id;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end if;
  return v_id;
exception
  when invalid_text_representation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- p_compra: id, negocio_id, proveedor_id, ubicacion_id, condicion, medio (solo contado, obligatorio), total, items
-- [{producto_id, cantidad, costo_unitario}]. Devuelve {id, total, condicion}.
create function public.registrar_compra(p_compra jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_id uuid;
  v_proveedor_id uuid;
  v_ubicacion_id uuid;
  v_condicion text;
  v_medio text;
  v_total numeric;
  v_total_items numeric := 0;
  v_items jsonb;
  v_item jsonb;
  v_ids uuid[] := '{}';
  v_cants numeric[] := '{}';
  v_costos numeric[] := '{}';
  v_pid uuid;
  v_cant numeric;
  v_costo numeric;
  i integer;
  v_producto public.productos;
  v_existente public.compras;
begin
  perform public.payload_claves(p_compra, array[
    'id', 'negocio_id', 'proveedor_id', 'ubicacion_id', 'condicion', 'medio', 'total', 'items']);
  v_negocio_id := public.payload_uuid(p_compra, 'negocio_id', false);
  if not public.tiene_permiso(v_negocio_id, 'gestionar_compras') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  v_id := public.payload_uuid(p_compra, 'id', false);
  v_proveedor_id := public.payload_uuid(p_compra, 'proveedor_id', false);
  v_ubicacion_id := public.payload_uuid(p_compra, 'ubicacion_id', false);
  v_condicion := public.payload_texto(p_compra, 'condicion', 10);
  v_total := public.payload_numero(p_compra, 'total', 2);
  v_items := p_compra -> 'items';
  if v_condicion not in ('contado', 'credito') or jsonb_typeof(v_items) is distinct from 'array'
     or jsonb_array_length(v_items) not between 1 and 200 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_condicion = 'contado' then
    v_medio := public.payload_texto(p_compra, 'medio', 20);
    if v_medio not in ('efectivo', 'qr', 'transferencia') then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  elsif p_compra ? 'medio' and jsonb_typeof(p_compra -> 'medio') <> 'null' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  -- Validación pura de los ítems y recálculo del total (el servidor manda).
  for v_item in select * from jsonb_array_elements(v_items) loop
    perform public.payload_claves(v_item, array['producto_id', 'cantidad', 'costo_unitario']);
    v_pid := public.payload_uuid(v_item, 'producto_id', false);
    v_cant := public.payload_numero(v_item, 'cantidad', 3);
    v_costo := public.payload_numero(v_item, 'costo_unitario', 4);
    if v_cant <= 0 or v_pid = any (v_ids) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_ids := v_ids || v_pid;
    v_cants := v_cants || v_cant;
    v_costos := v_costos || v_costo;
    v_total_items := v_total_items + round(v_cant * v_costo, 2);
  end loop;
  if v_total_items <> v_total then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if not public.reclamar_operacion(v_id, v_negocio_id, md5(p_compra::text)) then
    select * into v_existente from public.compras where id = v_id;
    return jsonb_build_object('id', v_existente.id, 'total', v_existente.total, 'condicion', v_existente.condicion);
  end if;

  perform 1 from public.proveedores where id = v_proveedor_id and negocio_id = v_negocio_id and activo for share;
  if not found then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  insert into public.compras (id, negocio_id, proveedor_id, ubicacion_id, total, condicion, usuario_id)
  values (v_id, v_negocio_id, v_proveedor_id, v_ubicacion_id, v_total, v_condicion, (select auth.uid()));

  for i in 1 .. cardinality(v_ids) loop
    v_producto := public.validar_inventario(v_negocio_id, v_ids[i], v_ubicacion_id, v_cants[i]);
    if not v_producto.activo then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end loop;
  -- Mismo orden de bloqueo que las ventas (por producto): sin interbloqueo con una venta concurrente.
  perform public.bloquear_stock(v_negocio_id, v_ubicacion_id, v_ids);
  for i in 1 .. cardinality(v_ids) loop
    insert into public.compra_items (compra_id, negocio_id, producto_id, cantidad, costo_unitario)
    values (v_id, v_negocio_id, v_ids[i], v_cants[i], v_costos[i]);
    insert into public.movimientos_inventario (
      negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id
    ) values (
      v_negocio_id, v_ubicacion_id, v_ids[i], 'compra', v_cants[i], v_costos[i], 'compra', v_id, (select auth.uid())
    );
  end loop;

  if v_condicion = 'contado' and v_total > 0 then
    insert into public.proveedor_pagos (id, negocio_id, proveedor_id, compra_id, monto, medio, usuario_id)
    values (gen_random_uuid(), v_negocio_id, v_proveedor_id, v_id, v_total, v_medio, (select auth.uid()));
  end if;
  return jsonb_build_object('id', v_id, 'total', round(v_total, 2), 'condicion', v_condicion);
exception
  when numeric_value_out_of_range or invalid_text_representation or foreign_key_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- Privado (sin grant): compras - pagos de un proveedor. La usa pagar_proveedor, que ya validó el permiso.
create function public.deuda_proveedor(p_proveedor_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sum(total) from public.compras where proveedor_id = p_proveedor_id), 0)
       - coalesce((select sum(monto) from public.proveedor_pagos where proveedor_id = p_proveedor_id), 0)
$$;

-- p_pago: id, negocio_id, proveedor_id, compra_id (opcional), monto > 0, medio. Devuelve el id del pago.
-- Bloquea la fila del proveedor: dos pagos concurrentes no pueden pasarse de la deuda.
create function public.pagar_proveedor(p_pago jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_id uuid;
  v_proveedor_id uuid;
  v_compra_id uuid;
  v_monto numeric;
  v_medio text;
  v_deuda numeric;
begin
  perform public.payload_claves(p_pago, array['id', 'negocio_id', 'proveedor_id', 'compra_id', 'monto', 'medio']);
  v_negocio_id := public.payload_uuid(p_pago, 'negocio_id', false);
  if not public.tiene_permiso(v_negocio_id, 'gestionar_compras') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  v_id := public.payload_uuid(p_pago, 'id', false);
  v_proveedor_id := public.payload_uuid(p_pago, 'proveedor_id', false);
  v_compra_id := public.payload_uuid(p_pago, 'compra_id', true);
  v_monto := public.payload_numero(p_pago, 'monto', 2);
  v_medio := public.payload_texto(p_pago, 'medio', 20);
  if v_monto <= 0 or v_medio not in ('efectivo', 'qr', 'transferencia') then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if not public.reclamar_operacion(v_id, v_negocio_id, md5(p_pago::text)) then
    return v_id;
  end if;

  perform 1 from public.proveedores where id = v_proveedor_id and negocio_id = v_negocio_id for update;
  if not found
     or (v_compra_id is not null
         and not exists (select 1 from public.compras
                         where id = v_compra_id and negocio_id = v_negocio_id and proveedor_id = v_proveedor_id)) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_deuda := public.deuda_proveedor(v_proveedor_id);
  if v_monto > v_deuda then
    raise exception 'ERP_PAGO_EXCEDE_DEUDA';
  end if;

  insert into public.proveedor_pagos (id, negocio_id, proveedor_id, compra_id, monto, medio, usuario_id)
  values (v_id, v_negocio_id, v_proveedor_id, v_compra_id, v_monto, v_medio, (select auth.uid()));
  return v_id;
exception
  when numeric_value_out_of_range or invalid_text_representation or foreign_key_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- Deuda por proveedor (todos los del negocio, activos o no).
create function public.deudas_proveedores(p_negocio_id uuid)
returns table (proveedor_id uuid, total_compras numeric, total_pagos numeric, deuda numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.tiene_permiso(p_negocio_id, 'gestionar_compras') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  return query
    select p.id, s.compras, s.pagos, s.compras - s.pagos
    from public.proveedores p
    cross join lateral (
      select coalesce((select sum(c.total) from public.compras c where c.proveedor_id = p.id), 0) as compras,
             coalesce((select sum(g.monto) from public.proveedor_pagos g where g.proveedor_id = p.id), 0) as pagos
    ) s
    where p.negocio_id = p_negocio_id;
end;
$$;

-- Total de compras puntuales, solo con ver_costos (compras.total no se lee por columna).
create function public.totales_compras(p_negocio_id uuid, p_compra_ids uuid[])
returns table (compra_id uuid, total numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.tiene_permiso(p_negocio_id, 'ver_costos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  return query
    select c.id, c.total from public.compras c
    where c.negocio_id = p_negocio_id and c.id = any (p_compra_ids);
end;
$$;

revoke all on function public.guardar_proveedor(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.registrar_compra(jsonb) from public, anon, authenticated;
revoke all on function public.pagar_proveedor(jsonb) from public, anon, authenticated;
revoke all on function public.deuda_proveedor(uuid) from public, anon, authenticated;
revoke all on function public.deudas_proveedores(uuid) from public, anon, authenticated;
revoke all on function public.totales_compras(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.guardar_proveedor(uuid, jsonb) to authenticated;
grant execute on function public.registrar_compra(jsonb) to authenticated;
grant execute on function public.pagar_proveedor(jsonb) to authenticated;
grant execute on function public.deudas_proveedores(uuid) to authenticated;
grant execute on function public.totales_compras(uuid, uuid[]) to authenticated;
