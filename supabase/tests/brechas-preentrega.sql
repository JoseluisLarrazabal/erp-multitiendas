-- Brechas de la preentrega (§4 de docs/plan-preentrega.md): cada caso fija lo que el sistema hace HOY, sin juzgarlo.
-- Compra sobre stock negativo y a costo 0, reserva con anticipo igual al total, crédito con descuento, vencimientos
-- de fin de mes y bisiesto, prepago total (M-3) y un frial nuevo sin productos (RF-FRI-03).
begin;
select plan(40);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t9700' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- d dueño de la tienda T · f dueño del frial F
select pg_temp.crear_usuario(n) from (values ('d'), ('f')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values
  (pg_temp.i('T'), 'T', 'tienda', 10), (pg_temp.i('F'), 'F', 'frial', 0);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('f'), pg_temp.i('F'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('U1'), pg_temp.i('T'), 'U1', 'local'), (pg_temp.i('UF'), pg_temp.i('F'), 'UF', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('D1'), pg_temp.i('T'), pg_temp.i('U1'), 'D1', 'C1');
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), 100);
insert into public.proveedores (id, negocio_id, nombre) values (pg_temp.i('PV'), pg_temp.i('T'), 'PV');
insert into public.clientes (id, negocio_id, nombre) values (pg_temp.i('CL'), pg_temp.i('T'), 'Cliente');
-- PA: stock -2 a costo 8 · PB: 5 a costo 8 · PR: reserva · PC: crédito con descuento · PD: prepago (crédito a 200)
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('PA'), pg_temp.i('T'), 'PA', 'PA', 'producto', 'unidad', false),
  (pg_temp.i('PB'), pg_temp.i('T'), 'PB', 'PB', 'producto', 'unidad', false),
  (pg_temp.i('PR'), pg_temp.i('T'), 'PR', 'PR', 'producto', 'unidad', false),
  (pg_temp.i('PC'), pg_temp.i('T'), 'PC', 'PC', 'producto', 'unidad', false),
  (pg_temp.i('PD'), pg_temp.i('T'), 'PD', 'PD', 'producto', 'unidad', false);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('PR'), 'contado', 10, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PC'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('PC'), 'credito', 12, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PD'), 'contado', 150, 'BOB'), (pg_temp.i('T'), pg_temp.i('PD'), 'credito', 200, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PA'), 'inicial', 10, 8),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PA'), 'ajuste', -12, 8),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PB'), 'inicial', 5, 8),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PR'), 'inicial', 10, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PC'), 'inicial', 100, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PD'), 'inicial', 100, 4);

create function pg_temp.stock(p text) returns numeric language sql as $$
  select cantidad from public.stock where producto_id = pg_temp.i(p) and ubicacion_id = pg_temp.i('U1')
$$;
create function pg_temp.costo(p text) returns numeric language sql security definer as $$
  select round(costo_promedio, 2) from public.stock where producto_id = pg_temp.i(p) and ubicacion_id = pg_temp.i('U1')
$$;
create function pg_temp.compra(o text, p text, cant numeric, costo numeric) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(o), 'negocio_id', pg_temp.i('T'), 'proveedor_id', pg_temp.i('PV'),
    'ubicacion_id', pg_temp.i('U1'), 'condicion', 'credito', 'total', round(cant * costo, 2),
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i(p), 'cantidad', cant, 'costo_unitario', costo)))
$$;
create function pg_temp.res_caja(p_clave text) returns numeric language sql as $$
  select (public.resumen_caja(pg_temp.i('S1')) ->> p_clave)::numeric
$$;
-- Venta en D1/S1. Con r (reserva) lleva reserva_id; con lista crédito lleva el bloque de crédito (3 cuotas).
create function pg_temp.venta(p_id text, p_num text, p_prod text, p_lista text, p_cant numeric, p_precio numeric,
  p_desc numeric, p_total numeric, p_pagos jsonb, p_reserva text default null) returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('D1'),
    'caja_sesion_id', pg_temp.i('S1'), 'numero', p_num, 'creada_en_cliente', now(), 'cliente_id', pg_temp.i('CL'),
    'reserva_id', case when p_reserva is null then null else pg_temp.i(p_reserva) end,
    'descuento', nullif(p_desc, 0), 'total', p_total,
    'condicion', case when p_lista = 'credito' then 'credito' end,
    'credito', case when p_lista = 'credito'
      then jsonb_build_object('cuotas', 3, 'docs_ci', true, 'docs_domicilio', false, 'docs_pagare', true) end,
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i(p_prod), 'lista', p_lista, 'cantidad', p_cant,
      'precio_unitario', p_precio)),
    'pagos', p_pagos))
$$;
create function pg_temp.vence(p_cred text) returns text[] language sql security definer as $$
  select array_agg(vence_en::text order by numero) from public.credito_cuotas where credito_id = pg_temp.i(p_cred)
$$;

-- Compra sobre stock negativo: la fórmula del promedio ignora el negativo (stock -2 a 8, entran 5 a 10).
select pg_temp.como(pg_temp.i('d'));
select is(pg_temp.stock('PA'), -2::numeric, 'premisa: PA arranca con stock -2');
select is(pg_temp.costo('PA'), 8.00, 'premisa: PA arranca con costo promedio 8');
select lives_ok($$select public.registrar_compra(pg_temp.compra('K1', 'PA', 5, 10))$$, 'compra de 5 a costo 10 sobre stock -2');
select is(pg_temp.stock('PA'), 3::numeric, 'stock -2 + 5 = 3');
select is(pg_temp.costo('PA'), 10.00, 'el promedio es el de la compra: el negativo cuenta como 0');

-- Compra a costo 0: baja el promedio a la mitad (5 a 8 más 5 a 0).
select lives_ok($$select public.registrar_compra(pg_temp.compra('K2', 'PB', 5, 0))$$, 'compra de 5 a costo 0 se acepta');
select is(pg_temp.stock('PB'), 10::numeric, 'stock 5 + 5 = 10');
select is(pg_temp.costo('PB'), 4.00, 'costo promedio (5 x 8 + 5 x 0) / 10 = 4');

-- Reserva con anticipo igual al total (2 x 10 = 20, anticipo 20): se crea; al completarla la venta no cobra nada más.
select lives_ok($$select public.crear_reserva(jsonb_build_object('id', pg_temp.i('R1'), 'dispositivo_id', pg_temp.i('D1'),
  'caja_sesion_id', pg_temp.i('S1'), 'cliente_id', pg_temp.i('CL'), 'producto_id', pg_temp.i('PR'), 'cantidad', 2,
  'precio_acordado', 10, 'anticipo', 20, 'medio', 'efectivo'))$$, 'reserva con anticipo igual al total');
select is(pg_temp.stock('PR'), 8::numeric, 'la reserva descuenta el disponible');
select is(pg_temp.res_caja('esperado'), 120::numeric, 'esperado: 100 + anticipo 20');
select lives_ok($$select public.registrar_venta(pg_temp.venta('V1', 'C1-000001', 'PR', 'contado', 2, 10, 0, 20,
  jsonb_build_array(jsonb_build_object('medio', 'anticipo', 'monto', 20)), 'R1'))$$,
  'completar con un solo pago anticipo por el total');
select is((select estado from public.reservas where id = pg_temp.i('R1')), 'completada', 'la reserva queda completada');
select is((select total from public.ventas where id = pg_temp.i('V1')), 20::numeric, 'venta por el total de la reserva');
select is((select array_agg(medio || ':' || monto order by medio) from public.venta_pagos where venta_id = pg_temp.i('V1')),
  array['anticipo:20.00'], 'la venta no tiene otro cobro que el anticipo');
select is(pg_temp.res_caja('esperado'), 120::numeric, 'el esperado sube solo por el anticipo, no por la venta');
select is(pg_temp.stock('PR'), 8::numeric, 'completar no descuenta dos veces');

-- Crédito con descuento: 10 x 12 = 120, descuento 10 -> total 110; inicial 55 (50 %) y el capital es 55.
select lives_ok($$select public.registrar_venta(pg_temp.venta('V2', 'C1-000002', 'PC', 'credito', 10, 12, 10, 110,
  jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', 55))))$$, 'crédito con descuento de venta');
select is((select total from public.ventas where id = pg_temp.i('V2')), 110::numeric, 'la venta es por el total con descuento');
select results_eq($$select capital, inicial from public.creditos where venta_id = pg_temp.i('V2')$$,
  $$values (55.00::numeric, 55.00::numeric)$$, 'el capital financiado sale del total con descuento');
select is((select sum(q.capital) from public.credito_cuotas q join public.creditos c on c.id = q.credito_id
  where c.venta_id = pg_temp.i('V2')), 55.00, 'las cuotas reparten ese capital');

-- Vencimientos de crear_credito_inicial: vence_en = primera + (n - 1) meses calendario, desde la fecha original.
-- La venta a crédito usa la misma aritmética (hoy + n meses): solo se prueba el saldo inicial, que admite fechas fijas.
select public.crear_credito_inicial(pg_temp.i(c), pg_temp.i('T'), pg_temp.i('CL'), 300, 3, f::date)
  from (values ('K29', '2026-01-29'), ('K30', '2026-01-30'), ('K31', '2026-01-31'),
               ('B29', '2024-01-29'), ('B31', '2024-01-31')) v (c, f);
select is(pg_temp.vence('K29'), array['2026-01-29', '2026-02-28', '2026-03-29'], 'desde el 29: febrero 28, marzo 29');
select is(pg_temp.vence('K30'), array['2026-01-30', '2026-02-28', '2026-03-30'], 'desde el 30: febrero 28, marzo 30');
select is(pg_temp.vence('K31'), array['2026-01-31', '2026-02-28', '2026-03-31'], 'desde el 31: febrero 28, marzo 31');
select is(pg_temp.vence('B29'), array['2024-01-29', '2024-02-29', '2024-03-29'], 'bisiesto desde el 29: febrero 29');
select is(pg_temp.vence('B31'), array['2024-01-31', '2024-02-29', '2024-03-31'], 'bisiesto desde el 31: febrero 29, marzo 31');

-- Prepago total (M-3): crédito de 1000 al 2,5 % en 3 cuotas, pagado entero de una vez. Se cobra el interés de las 3 cuotas.
select lives_ok($$select public.registrar_venta(pg_temp.venta('V3', 'C1-000003', 'PD', 'credito', 10, 200, 0, 2000,
  jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', 1000))))$$, 'crédito de 1000 a 3 cuotas');
select results_eq($$select capital, interes_mensual_pct from public.creditos where venta_id = pg_temp.i('V3')$$,
  $$values (1000.00::numeric, 2.50::numeric)$$, 'premisa: capital 1000 al 2,5 %');
select is((select sum(q.capital + q.interes) from public.credito_cuotas q join public.creditos c on c.id = q.credito_id
  where c.venta_id = pg_temp.i('V3')), 1050.41, 'las 3 cuotas suman 1050,41');
select lives_ok($$select public.pagar_cuota(jsonb_build_object('id', pg_temp.i('PP1'), 'credito_id',
  (select id from public.creditos where venta_id = pg_temp.i('V3')), 'dispositivo_id', pg_temp.i('D1'),
  'caja_sesion_id', pg_temp.i('S1'), 'efectivo', 1050.41, 'qr', 0))$$, 'se paga todo de una vez');
select is((select estado from public.creditos where venta_id = pg_temp.i('V3')), 'pagado', 'el crédito queda pagado');
select is((select sum(p.monto) from public.credito_pagos p join public.creditos c on c.id = p.credito_id
  where c.venta_id = pg_temp.i('V3')), 1050.41, 'lo cobrado incluye el interés de los 3 meses (50,41 sobre el capital)');
select throws_ok($$select public.pagar_cuota(jsonb_build_object('id', pg_temp.i('PP2'), 'credito_id',
  (select id from public.creditos where venta_id = pg_temp.i('V3')), 'dispositivo_id', pg_temp.i('D1'),
  'caja_sesion_id', pg_temp.i('S1'), 'efectivo', 1, 'qr', 0))$$, 'P0001', 'ERP_PAGO_EXCEDE_SALDO', 'ya pagado: no admite más');

-- RF-FRI-03: un frial nuevo sin productos no rompe nada y la primera entrada con lote funciona.
select pg_temp.como(pg_temp.i('f'));
select is(public.catalogo_pos(pg_temp.i('UF')) -> 'productos', '[]'::jsonb, 'catalogo_pos: productos es [] (no null)');
select is(jsonb_array_length(public.reporte_ventas(pg_temp.i('F'), current_date - 1, current_date, 'dia') -> 'filas'), 0,
  'reporte_ventas: sin filas');
select is(jsonb_array_length(public.reporte_stock(pg_temp.i('F')) -> 'filas'), 0, 'reporte_stock: sin filas');
select is(public.lotes_por_vencer(pg_temp.i('F'), 30), '[]'::jsonb, 'lotes_por_vencer: vacío');
reset role;
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('PF'), pg_temp.i('F'), 'PF', 'PF', 'producto', 'kg', false);
select pg_temp.como(pg_temp.i('f'));
select lives_ok($$select public.registrar_entrada_lote(pg_temp.i('E1'), pg_temp.i('F'), pg_temp.i('PF'), pg_temp.i('UF'), 5, 20, null,
  'L1', (now() at time zone 'America/La_Paz')::date + 3)$$, 'la primera entrada con lote funciona');
select is((select count(*) from jsonb_array_elements(public.lotes_por_vencer(pg_temp.i('F'), 30))), 1::bigint,
  'el lote aparece en lotes_por_vencer');
select is((select sum(cantidad) from public.stock where producto_id = pg_temp.i('PF')), 5::numeric, 'el stock del frial es 5');

select * from finish();
rollback;
