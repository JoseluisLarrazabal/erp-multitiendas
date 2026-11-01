-- Kardex, stock, series y conteos. Toda escritura pasa por RPC (20261101140100): authenticated solo lee.
-- El kardex es append-only; `stock` es caché del kardex y lo mantiene un trigger en la misma transacción.
-- Costos ocultos por columna: authenticated no tiene select sobre stock.costo_promedio ni
-- movimientos_inventario.costo_unitario (RLS filtra filas, no columnas). Se leen por costos_stock y kardex_producto.

create table public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null,
  ubicacion_id uuid not null,
  producto_id uuid not null,
  tipo text not null check (tipo in (
    'inicial', 'compra', 'entrada', 'venta', 'anulacion_venta', 'ajuste', 'danado', 'cambio_garantia',
    'devolucion_cliente', 'devolucion_proveedor', 'traslado_salida', 'traslado_entrada', 'reserva',
    'reserva_liberada', 'consumo', 'ajuste_costo'
  )),
  -- Con signo. Solo ajuste_costo tiene cantidad 0.
  cantidad numeric(12,3) not null check (cantidad <> 'NaN'),
  costo_unitario numeric(12,4) check (costo_unitario is null or (costo_unitario >= 0 and costo_unitario <> 'NaN')),
  ref_tipo text,
  -- Id de la operación (idempotencia) o del documento de origen.
  ref_id uuid,
  -- Sin FK: la tabla es append-only y con FK una cuenta jamás podría borrarse.
  usuario_id uuid,
  motivo text,
  -- clock_timestamp: el orden del kardex dentro de una transacción es el de inserción.
  created_at timestamptz not null default clock_timestamp(),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id),
  foreign key (negocio_id, ubicacion_id) references public.ubicaciones (negocio_id, id),
  constraint movimientos_cantidad_cero_ck check ((cantidad = 0) = (tipo = 'ajuste_costo')),
  constraint movimientos_ajuste_costo_ck check (tipo <> 'ajuste_costo' or costo_unitario is not null)
);
-- Idempotencia: repetir una operación no duplica el movimiento.
create unique index movimientos_operacion_uq on public.movimientos_inventario (ref_id, producto_id, ubicacion_id, tipo)
  where ref_id is not null;
-- Un solo stock inicial por producto y ubicación (la importación es repetible).
create unique index movimientos_inicial_uq on public.movimientos_inventario (producto_id, ubicacion_id)
  where tipo = 'inicial';
create index movimientos_negocio_fecha_idx on public.movimientos_inventario (negocio_id, created_at);
create index movimientos_producto_fecha_idx on public.movimientos_inventario (producto_id, created_at desc);

create table public.stock (
  negocio_id uuid not null,
  producto_id uuid not null,
  ubicacion_id uuid not null,
  cantidad numeric(12,3) not null default 0,
  costo_promedio numeric(12,4),
  updated_at timestamptz not null default now(),
  primary key (producto_id, ubicacion_id),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id),
  foreign key (negocio_id, ubicacion_id) references public.ubicaciones (negocio_id, id)
);
create index stock_negocio_idx on public.stock (negocio_id);

create table public.series (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null,
  producto_id uuid not null,
  serie text not null check (btrim(serie) <> ''),
  ubicacion_id uuid not null,
  -- baja: sale de disponible por ajuste, daño, devolución a proveedor. venta_id llega en la fase 2.
  estado text not null default 'disponible' check (estado in ('disponible', 'vendida', 'devuelta', 'baja')),
  created_at timestamptz not null default now(),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id),
  foreign key (negocio_id, ubicacion_id) references public.ubicaciones (negocio_id, id),
  unique (negocio_id, producto_id, serie)
);
create index series_ubicacion_idx on public.series (producto_id, ubicacion_id, estado);

-- id = UUID de la operación (idempotencia). Append-only, como el kardex que lo respalda.
create table public.conteos (
  id uuid primary key,
  negocio_id uuid not null,
  ubicacion_id uuid not null,
  fecha timestamptz not null default now(),
  usuario_id uuid,
  motivo text,
  foreign key (negocio_id, ubicacion_id) references public.ubicaciones (negocio_id, id),
  unique (negocio_id, id)
);

-- negocio_id para la policy y para impedir un producto de otro negocio.
create table public.conteo_items (
  conteo_id uuid not null,
  negocio_id uuid not null,
  producto_id uuid not null,
  cantidad_sistema numeric(12,3) not null,
  cantidad_contada numeric(12,3) not null check (cantidad_contada >= 0 and cantidad_contada <> 'NaN'),
  primary key (conteo_id, producto_id),
  foreign key (negocio_id, conteo_id) references public.conteos (negocio_id, id),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id)
);

-- Triggers

create trigger movimientos_solo_agregar
  before update or delete on public.movimientos_inventario
  for each row execute function public.rechazar_modificacion();
create trigger movimientos_sin_truncate
  before truncate on public.movimientos_inventario
  for each statement execute function public.rechazar_modificacion();

create trigger conteos_solo_agregar
  before update or delete on public.conteos
  for each row execute function public.rechazar_modificacion();
create trigger conteos_sin_truncate
  before truncate on public.conteos
  for each statement execute function public.rechazar_modificacion();
create trigger conteo_items_solo_agregar
  before update or delete on public.conteo_items
  for each row execute function public.rechazar_modificacion();
create trigger conteo_items_sin_truncate
  before truncate on public.conteo_items
  for each statement execute function public.rechazar_modificacion();

-- Todo el cálculo va dentro del on conflict do update: lee la fila vigente, también con escrituras concurrentes.
-- Entrada con costo: promedio ponderado con el stock previo (negativo cuenta 0); sin costo previo toma el nuevo.
-- ajuste_costo fija el promedio. El resto de los movimientos no lo toca.
create function public.aplicar_movimiento_a_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stock as s (negocio_id, producto_id, ubicacion_id, cantidad, costo_promedio)
  values (
    new.negocio_id, new.producto_id, new.ubicacion_id, new.cantidad,
    case when new.tipo = 'ajuste_costo' or new.cantidad > 0 then new.costo_unitario end
  )
  on conflict (producto_id, ubicacion_id) do update set
    cantidad = s.cantidad + new.cantidad,
    costo_promedio = case
      when new.tipo = 'ajuste_costo' then new.costo_unitario
      when new.cantidad > 0 and new.costo_unitario is not null then
        case
          when s.costo_promedio is null then new.costo_unitario
          else (greatest(s.cantidad, 0) * s.costo_promedio + new.cantidad * new.costo_unitario)
               / (greatest(s.cantidad, 0) + new.cantidad)
        end
      else s.costo_promedio
    end,
    updated_at = now();
  return null;
end;
$$;

revoke all on function public.aplicar_movimiento_a_stock() from public, anon, authenticated;

create trigger movimientos_aplicar_a_stock
  after insert on public.movimientos_inventario
  for each row execute function public.aplicar_movimiento_a_stock();

-- RLS: solo lectura. Sin policies de escritura.

alter table public.movimientos_inventario enable row level security;
alter table public.stock enable row level security;
alter table public.series enable row level security;
alter table public.conteos enable row level security;
alter table public.conteo_items enable row level security;

create policy movimientos_select on public.movimientos_inventario
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
create policy stock_select on public.stock
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
create policy series_select on public.series
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
create policy conteos_select on public.conteos
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
create policy conteo_items_select on public.conteo_items
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));

revoke all on public.movimientos_inventario from anon, authenticated, public;
revoke all on public.stock from anon, authenticated, public;
revoke all on public.series from anon, authenticated, public;
revoke all on public.conteos from anon, authenticated, public;
revoke all on public.conteo_items from anon, authenticated, public;

-- Sin costo_unitario ni costo_promedio: un select * falla con 42501; los costos salen por RPC.
grant select (id, negocio_id, ubicacion_id, producto_id, tipo, cantidad, ref_tipo, ref_id, usuario_id, motivo, created_at)
  on public.movimientos_inventario to authenticated;
grant select (negocio_id, producto_id, ubicacion_id, cantidad, updated_at) on public.stock to authenticated;
grant select on public.series to authenticated;
grant select on public.conteos to authenticated;
grant select on public.conteo_items to authenticated;
