-- Fase 5, PR 1: datos del frial. Peso fijo del paquete, lotes con vencimiento y mermas.
-- Sin errores nuevos: todo lo inválido es ERP_DATOS_INVALIDOS; reusar una operación con otro lote es ERP_OPERACION_REPETIDA.

-- 1. Paquete al vacío: unidad 'unidad' con peso fijo. Solo sirve para sumar kilos vendidos en el reporte.
alter table public.productos add column peso_paquete_kg numeric(12,3);
alter table public.productos add constraint productos_peso_paquete_ck
  check (peso_paquete_kg is null or (peso_paquete_kg > 0 and peso_paquete_kg <> 'NaN' and unidad = 'unidad' and tipo = 'producto'));

-- Misma vista con una columna más al final (create or replace no permite reordenar).
create or replace view public.productos_lista
with (security_invoker = true)
as
select
  p.id, p.negocio_id, p.codigo, p.codigo_barras, p.nombre, p.marca, p.modelo,
  p.categoria_id, c.nombre as categoria_nombre, p.tipo, p.unidad, p.activo, p.foto_path,
  exists (select 1 from public.producto_precios pp where pp.producto_id = p.id) as con_precio,
  pr.moneda as moneda_principal,
  pr.monto as monto_principal,
  pr.monto_bs as principal_bs,
  p.peso_paquete_kg
from public.productos p
left join public.categorias c on c.negocio_id = p.negocio_id and c.id = p.categoria_id
left join lateral (
  select b.moneda, b.monto, b.monto_bs
  from public.producto_precios_bs b
  where b.producto_id = p.id and b.lista in ('contado', 'normal')
  limit 1
) pr on true;

-- guardar_producto (20261101140300) con peso_paquete_kg. Al editar, sin la clave se conserva (como foto_path) y con
-- unidad kg se limpia.
-- Peso con unidad kg, cero o negativo: check_violation, ya traducido a ERP_DATOS_INVALIDOS.
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

revoke all on function public.guardar_producto(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_producto(uuid, jsonb) to authenticated;

-- 2. Lotes. Append-only: el saldo no se guarda, se estima en lotes_por_vencer (FIFO sobre el stock actual del producto).
create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null,
  producto_id uuid not null,
  ubicacion_id uuid not null,
  codigo text not null check (btrim(codigo) <> '' and length(codigo) <= 40),
  vence date not null,
  cantidad numeric(12,3) not null check (cantidad > 0 and cantidad <> 'NaN'),
  -- La entrada que lo creó. Un movimiento, un lote. Sin FK: con ella TRUNCATE del kardex fallaría por la FK en vez de
  -- por ERP_SOLO_AGREGAR, y la RPC es la única que escribe.
  movimiento_id uuid not null unique,
  -- Sin FK: la tabla es append-only y con FK una cuenta jamás podría borrarse.
  usuario_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id),
  foreign key (negocio_id, ubicacion_id) references public.ubicaciones (negocio_id, id)
);
create index lotes_producto_idx on public.lotes (negocio_id, producto_id);

create trigger lotes_solo_agregar
  before update or delete on public.lotes
  for each row execute function public.rechazar_modificacion();
create trigger lotes_sin_truncate
  before truncate on public.lotes
  for each statement execute function public.rechazar_modificacion();

alter table public.lotes enable row level security;
create policy lotes_select on public.lotes
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
revoke all on public.lotes from anon, authenticated, public;
grant select on public.lotes to authenticated;

-- 3. Merma: salida del frial por corte, vencimiento o desecho. Se trata como `danado` en todo el sistema.
-- not valid + validate: la validación no bloquea escrituras con lock exclusivo.
alter table public.movimientos_inventario drop constraint movimientos_inventario_tipo_check;
alter table public.movimientos_inventario add constraint movimientos_inventario_tipo_check check (tipo in (
  'inicial', 'compra', 'entrada', 'venta', 'anulacion_venta', 'ajuste', 'danado', 'cambio_garantia',
  'devolucion_cliente', 'devolucion_proveedor', 'traslado_salida', 'traslado_entrada', 'reserva',
  'reserva_liberada', 'consumo', 'ajuste_costo', 'merma'
)) not valid;
alter table public.movimientos_inventario validate constraint movimientos_inventario_tipo_check;

-- ajustar_inventario (20261101140100) con `merma` entre los tipos de salida. Misma firma.
create or replace function public.ajustar_inventario(
  p_operacion_id uuid, p_negocio_id uuid, p_producto_id uuid, p_ubicacion_id uuid,
  p_tipo text, p_cantidad numeric, p_motivo text, p_serie_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_producto public.productos;
  v_costo numeric;
  v_id uuid;
begin
  if not public.tiene_permiso(p_negocio_id, 'ajustar_inventario') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_operacion_id is null
     or p_tipo is null or p_tipo not in ('ajuste', 'danado', 'cambio_garantia', 'devolucion_proveedor', 'merma')
     or p_motivo is null or btrim(p_motivo) = ''
     or p_cantidad is null or p_cantidad = 0 or (p_tipo <> 'ajuste' and p_cantidad > 0) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  -- La merma es del frial.
  if p_tipo = 'merma' and (select tipo from public.negocios where id = p_negocio_id) is distinct from 'frial' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_producto := public.validar_inventario(p_negocio_id, p_producto_id, p_ubicacion_id, p_cantidad);
  -- Las series se exigen en la salida de un producto con serie y no valen en ningún otro caso.
  if (p_serie_ids is not null) <> (v_producto.controla_serie and p_cantidad < 0) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if not public.reclamar_operacion(p_operacion_id, p_negocio_id, md5(jsonb_build_array(
       'ajuste', p_negocio_id, p_producto_id, p_ubicacion_id, p_tipo, p_cantidad, p_motivo, to_jsonb(p_serie_ids))::text)) then
    return (select id from public.movimientos_inventario where ref_id = p_operacion_id);
  end if;

  if p_cantidad < 0 then
    select costo_promedio into v_costo from public.stock
    where producto_id = p_producto_id and ubicacion_id = p_ubicacion_id;
  end if;

  insert into public.movimientos_inventario (
    negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
  ) values (
    p_negocio_id, p_ubicacion_id, p_producto_id, p_tipo, p_cantidad, v_costo, 'operacion',
    p_operacion_id, (select auth.uid()), btrim(p_motivo)
  )
  returning id into v_id;

  if p_serie_ids is not null then
    perform public.bloquear_series(p_negocio_id, p_producto_id, p_ubicacion_id, p_serie_ids, -p_cantidad);
    update public.series set estado = 'baja' where id = any (p_serie_ids);
  end if;
  return v_id;
exception
  when numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

revoke all on function public.ajustar_inventario(uuid, uuid, uuid, uuid, text, numeric, text, uuid[]) from public, anon, authenticated;
grant execute on function public.ajustar_inventario(uuid, uuid, uuid, uuid, text, numeric, text, uuid[]) to authenticated;

-- 4. Entrada con lote. Hace la entrada con registrar_entrada (permiso, validación e idempotencia por operación) y
-- liga el lote al movimiento. Devuelve el id del lote. Reintento igual: mismo lote, nada se duplica. Misma operación
-- con otro código o vencimiento: ERP_OPERACION_REPETIDA. Hoy es la fecha de La Paz; el reintento no la revisa.
create function public.registrar_entrada_lote(
  p_operacion_id uuid, p_negocio_id uuid, p_producto_id uuid, p_ubicacion_id uuid,
  p_cantidad numeric, p_costo_unitario numeric, p_motivo text, p_lote text, p_vence date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text := btrim(p_lote);
  v_mov_id uuid;
  v_lote public.lotes;
  v_lote_id uuid;
begin
  if not public.tiene_permiso(p_negocio_id, 'ajustar_inventario') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_codigo is null or v_codigo = '' or length(v_codigo) > 40 or p_vence is null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  -- La operación ya es una entrada sin lote (registrar_entrada): no se le pega un lote después.
  if exists (select 1 from public.movimientos_inventario m where m.ref_id = p_operacion_id and m.negocio_id = p_negocio_id)
     and not exists (select 1 from public.lotes l join public.movimientos_inventario m on m.id = l.movimiento_id
                     where m.ref_id = p_operacion_id and m.negocio_id = p_negocio_id) then
    raise exception 'ERP_OPERACION_REPETIDA';
  end if;

  v_mov_id := public.registrar_entrada(
    p_operacion_id, p_negocio_id, p_producto_id, p_ubicacion_id, p_cantidad, p_costo_unitario, p_motivo);

  select * into v_lote from public.lotes where movimiento_id = v_mov_id;
  if found then
    if v_lote.codigo <> v_codigo or v_lote.vence <> p_vence then
      raise exception 'ERP_OPERACION_REPETIDA';
    end if;
    return v_lote.id;
  end if;

  -- Un error aquí deshace también la entrada: es la misma transacción.
  if p_vence < (now() at time zone 'America/La_Paz')::date
     or (select controla_serie from public.productos where id = p_producto_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  insert into public.lotes (negocio_id, producto_id, ubicacion_id, codigo, vence, cantidad, movimiento_id, usuario_id)
  values (p_negocio_id, p_producto_id, p_ubicacion_id, v_codigo, p_vence, p_cantidad, v_mov_id, (select auth.uid()))
  returning id into v_lote_id;
  return v_lote_id;
end;
$$;

revoke all on function public.registrar_entrada_lote(uuid, uuid, uuid, uuid, numeric, numeric, text, text, date) from public, anon, authenticated;
grant execute on function public.registrar_entrada_lote(uuid, uuid, uuid, uuid, numeric, numeric, text, text, date) to authenticated;

-- 5. Lotes por vencer con saldo estimado. Devuelve un arreglo jsonb (no setof): una lectura que devuelve filas pasa por
-- el max_rows de PostgREST y se truncaría en silencio. El saldo es por producto en el negocio (los traslados no cuentan):
-- stock total menos lo que entró después del lote (lotes más nuevos y entradas sin lote), acotado a [0, cantidad del lote].
-- Es FIFO: lo más viejo se consume primero. ubicacion_nombre es donde entró el lote. Incluye vencidos con saldo > 0 y vence <= hoy + p_dias.
create function public.lotes_por_vencer(p_negocio_id uuid, p_dias integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/La_Paz')::date;
begin
  if not (public.tiene_permiso(p_negocio_id, 'ajustar_inventario') or public.tiene_permiso(p_negocio_id, 'ver_reportes')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_dias is null or p_dias < 0 or p_dias > 3650 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'lote_id', t.id, 'codigo', t.codigo, 'vence', t.vence, 'dias_restantes', t.vence - v_hoy,
      'cantidad', t.cantidad, 'saldo', t.saldo,
      'producto_id', t.producto_id, 'producto_codigo', p.codigo, 'producto_nombre', p.nombre,
      'ubicacion_id', t.ubicacion_id, 'ubicacion_nombre', u.nombre
    ) order by t.vence, t.created_at, t.id)
    from (
      select l.*,
        greatest(0, least(l.cantidad,
          coalesce((select sum(s.cantidad) from public.stock s
                    where s.negocio_id = l.negocio_id and s.producto_id = l.producto_id), 0)
          - coalesce((select sum(m.cantidad) from public.movimientos_inventario m
                      where m.negocio_id = l.negocio_id and m.producto_id = l.producto_id
                        and m.tipo in ('inicial', 'compra', 'entrada') and m.cantidad > 0
                        and m.id <> l.movimiento_id and (m.created_at, m.id) > (lm.created_at, lm.id)), 0))) as saldo
      from public.lotes l
      join public.movimientos_inventario lm on lm.id = l.movimiento_id
      where l.negocio_id = p_negocio_id
    ) t
    join public.productos p on p.id = t.producto_id
    join public.ubicaciones u on u.id = t.ubicacion_id
    where t.saldo > 0 and t.vence <= v_hoy + p_dias
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.lotes_por_vencer(uuid, integer) from public, anon, authenticated;
grant execute on function public.lotes_por_vencer(uuid, integer) to authenticated;
