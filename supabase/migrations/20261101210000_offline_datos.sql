-- Fase 3, PR 1: datos para la venta sin conexión. Marcas de revisión en ventas, verificación de pagos QR y precio de
-- lista opcional (RN-03: una venta offline de un producto sin precio se acepta y queda marcada).
-- Las tablas siguen siendo append-only salvo estas marcas, que solo pasan de vacío a lleno por RPC.

-- Marcas válidas: las que registrar_venta pone con p_offline (20261101210100).
alter table public.ventas
  add column motivos_revision text[] not null default '{}'
    check (motivos_revision <@ array['producto_inactivo', 'sin_precio', 'descuento_sin_permiso', 'sobre_tope', 'renumerada', 'otra_cuenta']),
  add column revisada_por uuid references public.perfiles (id),
  add column revisada_en timestamptz,
  add constraint ventas_revision_ck check ((revisada_por is null) = (revisada_en is null));

-- QR: pendiente pasa a verificado (llegó) o a rechazado (nunca llegó), con quién y cuándo. El ck medio/verificación
-- (efectivo = no_aplica) sigue valiendo: rechazado es siempre QR.
alter table public.venta_pagos
  drop constraint venta_pagos_verificacion_check,
  add constraint venta_pagos_verificacion_check check (verificacion in ('no_aplica', 'pendiente', 'verificado', 'rechazado')),
  add column verificado_por uuid references public.perfiles (id),
  add column verificado_en timestamptz,
  add constraint venta_pagos_verificado_ck check (
    (verificado_por is null) = (verificado_en is null)
    and (verificado_por is null or verificacion in ('verificado', 'rechazado')));

-- Rastro de lo que mandó el cliente (RN-04): desde dónde se registró y quién lo envió. Nulo en filas anteriores a la fase 3.
alter table public.caja_sesiones
  add column origen text not null default 'online' check (origen in ('online', 'offline')),
  add column enviada_por uuid references public.perfiles (id);
alter table public.caja_movimientos
  add column origen text not null default 'online' check (origen in ('online', 'offline')),
  add column enviada_por uuid references public.perfiles (id);

-- Sin precio de lista al vender: queda nulo (el check > 0 no aplica a null).
alter table public.venta_items alter column precio_lista_servidor drop not null;

-- Cola de reconciliación: solo ventas offline.
create index ventas_offline_idx on public.ventas (negocio_id, recibida_en desc, id desc) where origen = 'offline';

-- La venta cambia de completada a anulada (anular_venta) y fija la revisión una sola vez (revisar_venta); nada más.
create or replace function public.venta_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     or (to_jsonb(new) - 'estado' - 'anulada_en' - 'anulada_por' - 'motivo_anulacion' - 'revisada_por' - 'revisada_en')
        is distinct from
        (to_jsonb(old) - 'estado' - 'anulada_en' - 'anulada_por' - 'motivo_anulacion' - 'revisada_por' - 'revisada_en')
     or (new.estado is distinct from old.estado and not (old.estado = 'completada' and new.estado = 'anulada'))
     or (new.estado = old.estado
         and (new.anulada_en, new.anulada_por, new.motivo_anulacion)
             is distinct from (old.anulada_en, old.anulada_por, old.motivo_anulacion))
     or (old.revisada_por is not null
         and (new.revisada_por, new.revisada_en) is distinct from (old.revisada_por, old.revisada_en)) then
    raise exception 'ERP_SOLO_AGREGAR';
  end if;
  return new;
end;
$$;

-- El pago solo pasa de pendiente a verificado o rechazado (verificar_pago_qr), con quién y cuándo. Nada más cambia ni se borra.
create function public.venta_pago_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.verificacion <> 'pendiente' or new.verificacion not in ('verificado', 'rechazado')
     or new.verificado_por is null
     or (to_jsonb(new) - 'verificacion' - 'verificado_por' - 'verificado_en')
        is distinct from (to_jsonb(old) - 'verificacion' - 'verificado_por' - 'verificado_en') then
    raise exception 'ERP_SOLO_AGREGAR';
  end if;
  return new;
end;
$$;
revoke all on function public.venta_pago_inmutable() from public, anon, authenticated;

drop trigger venta_pagos_solo_agregar on public.venta_pagos;
create trigger venta_pagos_solo_agregar before update or delete on public.venta_pagos
  for each row execute function public.venta_pago_inmutable();

-- La sesión abierta solo cambia al cerrarse: ni el origen ni quién la envió se tocan.
create or replace function public.caja_sesion_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.cerrada_en is not null
     or (new.id, new.negocio_id, new.dispositivo_id, new.usuario_apertura, new.abierta_en, new.monto_inicial, new.origen, new.enviada_por)
        is distinct from
        (old.id, old.negocio_id, old.dispositivo_id, old.usuario_apertura, old.abierta_en, old.monto_inicial, old.origen, old.enviada_por) then
    raise exception 'ERP_SOLO_AGREGAR';
  end if;
  return new;
end;
$$;

-- Grants por columna de ventas: las marcas se leen; la huella sigue oculta. venta_pagos tiene select de tabla.
grant select (motivos_revision, revisada_por, revisada_en) on public.ventas to authenticated;
