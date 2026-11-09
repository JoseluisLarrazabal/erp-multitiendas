-- Venta a crédito, cuotas y cuentas por cobrar (RF-CRE-01 a 06): DB-21 (cuotas = capital más interés, P-07), DB-22 (pago parcial y
-- total; pagar de más se rechaza), arqueo con cuotas, piso de precios en la lista crédito, rechazo offline, idempotencia, equipo
-- ajeno, aislamiento entre negocios, permisos por rol, anular y devolver rechazados, saldo inicial, FIFO y vencidas.
begin;
select plan(222);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t8160' || n)::uuid $$;
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/La_Paz')::date $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- d dueño de T · e encargado de T · v vendedor de T · c contador de T · y dueño de T2 · x dueño de la lavandería L
select pg_temp.crear_usuario(n) from (values ('d'), ('e'), ('v'), ('c'), ('y'), ('x')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values
  (pg_temp.i('T'), 'T', 'tienda', 10), (pg_temp.i('T2'), 'T2', 'tienda', 10), (pg_temp.i('L'), 'L', 'lavanderia', 0);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('e'), pg_temp.i('T'), 'encargado'), (pg_temp.i('v'), pg_temp.i('T'), 'vendedor'),
  (pg_temp.i('c'), pg_temp.i('T'), 'contador'), (pg_temp.i('y'), pg_temp.i('T2'), 'dueno'), (pg_temp.i('x'), pg_temp.i('L'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('U1'), pg_temp.i('T'), 'U1', 'local'), (pg_temp.i('UX'), pg_temp.i('T2'), 'UX', 'local'),
  (pg_temp.i('UL'), pg_temp.i('L'), 'UL', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('D1'), pg_temp.i('T'), pg_temp.i('U1'), 'D1', 'C1'), (pg_temp.i('D2'), pg_temp.i('T'), pg_temp.i('U1'), 'D2', 'C2'),
  (pg_temp.i('D3'), pg_temp.i('T'), pg_temp.i('U1'), 'D3', 'C3'), (pg_temp.i('DX'), pg_temp.i('T2'), pg_temp.i('UX'), 'DX', 'X1'),
  (pg_temp.i('DL'), pg_temp.i('L'), pg_temp.i('UL'), 'DL', 'L1');
-- S1 (inicial 100) y S2 (inicial 0) abiertas en U1 · SC cerrada (D3)
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), 100), (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('D2'), pg_temp.i('d'), 0),
  (pg_temp.i('SX'), pg_temp.i('T2'), pg_temp.i('DX'), pg_temp.i('y'), 0), (pg_temp.i('SL'), pg_temp.i('L'), pg_temp.i('DL'), pg_temp.i('x'), 0);
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial, cerrada_en, usuario_cierre,
  monto_contado, monto_esperado, diferencia) values
  (pg_temp.i('SC'), pg_temp.i('T'), pg_temp.i('D3'), pg_temp.i('d'), 0, now(), pg_temp.i('d'), 0, 0, 0);
insert into public.clientes (id, negocio_id, nombre) values
  (pg_temp.i('CL'), pg_temp.i('T'), 'Cliente'), (pg_temp.i('CL2'), pg_temp.i('T'), 'Otro'), (pg_temp.i('CLX'), pg_temp.i('T2'), 'ClienteX'),
  (pg_temp.i('CLL'), pg_temp.i('L'), 'ClienteL');
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('P1'), pg_temp.i('T'), 'P1', 'P1', 'producto', 'unidad', false),
  (pg_temp.i('PF'), pg_temp.i('T'), 'PF', 'PF', 'producto', 'unidad', false),
  (pg_temp.i('PN'), pg_temp.i('T'), 'PN', 'PN', 'producto', 'unidad', false),
  (pg_temp.i('PL'), pg_temp.i('L'), 'PL', 'PL', 'producto', 'unidad', false);
-- P1: contado 10, crédito 12 · PF: contado 10, crédito 12, mínimo 11 (piso de crédito = least(11, 12) = 11) · PN: solo contado
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('P1'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('P1'), 'credito', 12, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PF'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('PF'), 'credito', 12, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PF'), 'minimo', 11, 'BOB'), (pg_temp.i('T'), pg_temp.i('PN'), 'contado', 10, 'BOB'),
  (pg_temp.i('L'), pg_temp.i('PL'), 'normal', 10, 'BOB'), (pg_temp.i('L'), pg_temp.i('PL'), 'credito', 12, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'inicial', 100, 4), (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PF'), 'inicial', 100, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PN'), 'inicial', 100, 4), (pg_temp.i('L'), pg_temp.i('UL'), pg_temp.i('PL'), 'inicial', 100, 4);

create function pg_temp.disp(ses text) returns uuid language sql as $$
  select pg_temp.i(case ses when 'S1' then 'D1' when 'S2' then 'D2' when 'SX' then 'DX' when 'SL' then 'DL' when 'SC' then 'D3' end)
$$;
-- Venta a crédito en D1/S1: cant x precio de la lista, inicial en efectivo, n cuotas, documentos marcados.
create function pg_temp.vc(p_id text, p_num text, p_cant numeric, p_precio numeric, p_inicial numeric, p_cuotas integer,
  p_prod text default 'P1', p_lista text default 'credito') returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('D1'), 'caja_sesion_id', pg_temp.i('S1'), 'numero', p_num,
    'creada_en_cliente', now(), 'cliente_id', pg_temp.i('CL'), 'total', round(p_cant * p_precio, 2),
    'condicion', 'credito', 'credito', jsonb_build_object('cuotas', p_cuotas, 'docs_ci', true, 'docs_domicilio', false, 'docs_pagare', true),
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i(p_prod), 'lista', p_lista, 'cantidad', p_cant,
      'precio_unitario', p_precio)),
    'pagos', jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', p_inicial)))
$$;
-- Id del crédito de una venta.
create function pg_temp.cred(p_venta text) returns uuid language sql security definer as $$
  select id from public.creditos where venta_id = pg_temp.i(p_venta)
$$;
create function pg_temp.costo_item(p_venta text) returns numeric language sql security definer as $$
  select costo_unitario from public.venta_items where venta_id = pg_temp.i(p_venta)
$$;
create function pg_temp.saldo(p_cred uuid) returns numeric language sql security definer as $$
  select (public.detalle_credito(p_cred) ->> 'saldo')::numeric
$$;
create function pg_temp.res_caja(p_ses text, p_clave text) returns numeric language sql as $$
  select (public.resumen_caja(pg_temp.i(p_ses)) ->> p_clave)::numeric
$$;
create function pg_temp.stock(p text) returns numeric language sql as $$
  select cantidad from public.stock where producto_id = pg_temp.i(p) and ubicacion_id = pg_temp.i('U1')
$$;

select ok(has_function_privilege('authenticated', 'public.pagar_cuota(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.crear_credito_inicial(uuid, uuid, uuid, numeric, integer, date)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.guardar_credito_config(uuid, numeric, integer, integer, numeric)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.cuentas_por_cobrar(uuid, uuid, boolean, integer, integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.detalle_credito(uuid, uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.credito_parametros(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.pagar_cuota(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.cuentas_por_cobrar(uuid, uuid, boolean, integer, integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.plan_cuotas(numeric, numeric, integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.cuotas_con_pago(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.credito_params(uuid)', 'EXECUTE'), 'solo authenticated ejecuta las públicas; las privadas no');
select ok(not exists (select 1 from pg_proc p where p.proname in ('registrar_venta', 'efectivo_esperado', 'total_qr_sesion',
    'anular_venta', 'devolver_venta', 'resumen_caja', 'reporte_caja') and p.pronamespace = 'public'::regnamespace
  group by p.proname having count(*) > 1), 'las funciones redefinidas no crearon sobrecargas');

-- DB-21: plan_cuotas (sistema francés, P-07). 1000 al 2,5 % en 3 cuotas: cuota 350,14, la última absorbe 0,01.
select is((select array_agg(numero || ':' || capital || ':' || interes order by numero) from public.plan_cuotas(1000, 2.5, 3)),
  array['1:325.14:25.00', '2:333.27:16.87', '3:341.59:8.54'], 'DB-21: plan 1000 / 2,5 % / 3');
select is((select sum(capital) from public.plan_cuotas(1000, 2.5, 3)), 1000.00, 'DB-21: el capital de las cuotas suma el capital');
select is((select sum(capital + interes) from public.plan_cuotas(1000, 2.5, 3)), 1050.41, 'DB-21: cuotas = capital más interés (350,14 + 350,14 + 350,13)');
select is((select array_agg(capital + interes order by numero) from public.plan_cuotas(1000, 2.5, 3)), array[350.14, 350.14, 350.13], 'DB-21: la última cuota absorbe la diferencia');
select is((select array_agg(capital + interes order by numero) from public.plan_cuotas(100, 0, 3)), array[33.33, 33.33, 33.34], 'sin interés: capital / n y la última absorbe');
select is((select count(*) from public.plan_cuotas(500, 2.5, 1)), 1::bigint, 'una cuota');
select is((select capital + interes from public.plan_cuotas(500, 2.5, 1)), 512.50, 'una cuota: capital más un mes de interés');
select is((select sum(capital) from public.plan_cuotas(1234.56, 2.5, 12)), 1234.56, '12 cuotas: el capital suma exacto');
select throws_ok($$select * from public.plan_cuotas(1000, 2.5, 0)$$, 'ERP_DATOS_INVALIDOS', 'plan: cero cuotas');
select throws_ok($$select * from public.plan_cuotas(0, 2.5, 3)$$, 'ERP_DATOS_INVALIDOS', 'plan: capital cero');
select throws_ok($$select * from public.plan_cuotas(10.005, 2.5, 3)$$, 'ERP_DATOS_INVALIDOS', 'plan: capital con más de 2 decimales');
select throws_ok($$select * from public.plan_cuotas(1000, -1, 3)$$, 'ERP_DATOS_INVALIDOS', 'plan: interés negativo');
select throws_ok($$select * from public.plan_cuotas(0.02, 0, 5)$$, 'ERP_DATOS_INVALIDOS', 'plan: capital demasiado chico para las cuotas');

-- Parámetros: sin fila rigen los valores por defecto.
select pg_temp.como(pg_temp.i('e'));
select is((select to_jsonb(p) from public.credito_parametros(pg_temp.i('T')) p),
  '{"inicial_pct":50.00,"plazo_cuotas":3,"max_cuotas":12,"interes_mensual_pct":2.50}'::jsonb, 'parámetros por defecto');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select * from public.credito_parametros(pg_temp.i('T'))$$, 'ERP_SIN_PERMISO', 'vendedor no lee los parámetros');
select throws_ok($$select public.guardar_credito_config(pg_temp.i('T'), 30, 3, 12, 2.5)$$, 'ERP_SIN_PERMISO', 'vendedor no guarda parámetros');
select pg_temp.como(pg_temp.i('c'));
select ok((select count(*) from public.credito_parametros(pg_temp.i('T'))) = 1, 'contador lee los parámetros (ver_reportes)');
select throws_ok($$select public.guardar_credito_config(pg_temp.i('T'), 30, 3, 12, 2.5)$$, 'ERP_SIN_PERMISO', 'contador no guarda parámetros');
select pg_temp.como(pg_temp.i('y'));
select throws_ok($$select public.guardar_credito_config(pg_temp.i('T'), 30, 3, 12, 2.5)$$, 'ERP_SIN_PERMISO', 'dueño de otro negocio no guarda');
select throws_ok($$select * from public.credito_parametros(pg_temp.i('T'))$$, 'ERP_SIN_PERMISO', 'dueño de otro negocio no lee');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.guardar_credito_config(pg_temp.i('L'), 30, 3, 12, 2.5)$$, 'ERP_SIN_PERMISO', 'lavandería no tiene gestionar_credito');
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select public.guardar_credito_config(pg_temp.i('T'), 100, 3, 12, 2.5)$$, 'ERP_DATOS_INVALIDOS', 'inicial 100 %');
select throws_ok($$select public.guardar_credito_config(pg_temp.i('T'), 30, 13, 12, 2.5)$$, 'ERP_DATOS_INVALIDOS', 'plazo mayor que el máximo');
select throws_ok($$select public.guardar_credito_config(pg_temp.i('T'), 30, 3, 37, 2.5)$$, 'ERP_DATOS_INVALIDOS', 'máximo mayor que 36');
select throws_ok($$select public.guardar_credito_config(pg_temp.i('T'), 30, 3, 12, -1)$$, 'ERP_DATOS_INVALIDOS', 'interés negativo');
select throws_ok($$select public.guardar_credito_config(pg_temp.i('T'), 30.123, 3, 12, 2.5)$$, 'ERP_DATOS_INVALIDOS', 'inicial con 3 decimales');

-- Venta a crédito (e: encargado, gestionar_credito y descontar). V1: 10 de P1 a 12 (lista crédito) = 120; inicial 60 (50 %); 3 cuotas.
select is(public.registrar_venta(pg_temp.vc('V1', 'C1-000001', 10, 12, 60, 3)), jsonb_build_object('id', pg_temp.i('V1'), 'numero', 'C1-000001', 'total', 120.00),
  'V1: venta a crédito');
select is((select condicion from public.ventas where id = pg_temp.i('V1')), 'credito', 'la venta queda con condicion crédito');
select is((select total from public.ventas where id = pg_temp.i('V1')), 120.00, 'el total de la venta es el total completo');
select is((select sum(monto) from public.venta_pagos where venta_id = pg_temp.i('V1')), 60.00, 'los pagos suman la inicial');
select is((select lista from public.venta_items where venta_id = pg_temp.i('V1')), 'credito', 'la línea va en lista crédito');
select is(pg_temp.costo_item('V1'), 4.0000, 'costo de la línea = promedio actual');
select is(pg_temp.stock('P1'), 90::numeric, 'la venta a crédito descuenta el stock');
select is((select capital || '/' || inicial || '/' || interes_mensual_pct || '/' || estado || '/' || origen from public.creditos where venta_id = pg_temp.i('V1')),
  '60.00/60.00/2.50/activo/venta', 'crédito: capital = total menos inicial; parámetros copiados');
select is((select docs_ci::text || docs_domicilio::text || docs_pagare::text from public.creditos where venta_id = pg_temp.i('V1')),
  'truefalsetrue', 'los documentos quedan registrados');
select is((select count(*) from public.credito_cuotas where credito_id = pg_temp.cred('V1')), 3::bigint, 'tres cuotas');
select is((select sum(capital) from public.credito_cuotas where credito_id = pg_temp.cred('V1')), 60.00, 'las cuotas suman el capital financiado');
select is((select array_agg(capital + interes order by numero) from public.credito_cuotas where credito_id = pg_temp.cred('V1')),
  array[21.01, 21.01, 21.00], 'DB-21: 60 al 2,5 % en 3 cuotas = 21,01 / 21,01 / 21,00');
select is((select min(vence_en) from public.credito_cuotas where credito_id = pg_temp.cred('V1')), (pg_temp.hoy() + interval '1 month')::date,
  'la primera cuota vence al mes');
select is((select max(vence_en) from public.credito_cuotas where credito_id = pg_temp.cred('V1')), (pg_temp.hoy() + interval '3 month')::date,
  'la tercera vence a los 3 meses');
select pg_temp.como(pg_temp.i('e'));
select is(pg_temp.saldo(pg_temp.cred('V1')), 63.02, 'saldo inicial = suma de cuotas (60 + 3,02 de interés)');
-- Reenvío idempotente
select is(public.registrar_venta(pg_temp.vc('V1', 'C1-000001', 10, 12, 60, 3)) ->> 'id', pg_temp.i('V1')::text, 'reenvío: devuelve la venta');
select is((select count(*) from public.creditos where venta_id = pg_temp.i('V1')), 1::bigint, 'reenvío: un solo crédito');
select is((select count(*) from public.credito_cuotas where credito_id = pg_temp.cred('V1')), 3::bigint, 'reenvío: sin cuotas duplicadas');
select is(pg_temp.stock('P1'), 90::numeric, 'reenvío: stock intacto');
select throws_ok($$select public.registrar_venta(pg_temp.vc('V1', 'C1-000001', 10, 12, 70, 3))$$, 'ERP_OPERACION_REPETIDA', 'mismo id con otra inicial');

-- Rechazos de la venta a crédito
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vx1', 'C1-000002', 10, 12, 59.99, 3))$$, 'ERP_INICIAL_INSUFICIENTE', 'inicial bajo el mínimo (50 %)');
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vx2', 'C1-000002', 10, 12, 120, 3))$$, 'ERP_DATOS_INVALIDOS', 'inicial igual al total: no hay crédito');
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vx3', 'C1-000002', 10, 12, 60, 13))$$, 'ERP_DATOS_INVALIDOS', 'más cuotas que el máximo');
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vx4', 'C1-000002', 10, 12, 60, 0))$$, 'ERP_DATOS_INVALIDOS', 'cero cuotas');
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vx5', 'C1-000002', 10, 12, 60, 3, 'P1', 'contado'))$$, 'ERP_DATOS_INVALIDOS', 'línea de contado en una venta a crédito');
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vx6', 'C1-000002', 10, 12, 60, 3) - 'condicion')$$, 'ERP_DATOS_INVALIDOS', 'bloque credito sin condicion');
select throws_ok($$select public.registrar_venta(jsonb_set(pg_temp.vc('Vx7', 'C1-000002', 10, 12, 60, 3), '{cliente_id}', 'null'))$$, 'ERP_DATOS_INVALIDOS', 'sin cliente');
select throws_ok($$select public.registrar_venta(jsonb_set(pg_temp.vc('Vx8', 'C1-000002', 10, 12, 60, 3), '{cliente_id}', to_jsonb(pg_temp.i('CLX')::text)))$$, 'ERP_DATOS_INVALIDOS', 'cliente de otro negocio');
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vx9', 'C1-000002', 10, 12, 60, 3) || '{"condicion": "otra"}')$$, 'ERP_DATOS_INVALIDOS', 'condicion inválida');
select throws_ok($$select public.registrar_venta(jsonb_set(pg_temp.vc('Vxa', 'C1-000002', 10, 12, 60, 3), '{credito,extra}', '1'))$$, 'ERP_DATOS_INVALIDOS', 'clave desconocida en el bloque');
select throws_ok($$select public.registrar_venta(jsonb_set(pg_temp.vc('Vxb', 'C1-000002', 10, 12, 60, 3), '{credito,docs_ci}', '"si"'))$$, 'ERP_DATOS_INVALIDOS', 'documento no booleano');
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vxc', 'C1-000002', 10, 12, 60, 3) || jsonb_build_object('reserva_id', pg_temp.i('R')))$$, 'ERP_DATOS_INVALIDOS', 'crédito con reserva');
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vxd', 'C1-000002', 10, 12, 60, 3, 'PN'))$$, 'ERP_PRODUCTO_SIN_PRECIO', 'producto sin precio de crédito');
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vxe', 'C1-000002', 10, 12, 60, 3), jsonb_build_object('vendedor_id', pg_temp.i('e'), 'tipo_cambio', null))$$,
  'ERP_REQUIERE_CONEXION', 'DB: el crédito nunca se encola (p_offline)');
select throws_ok($$select public.registrar_venta(jsonb_set(pg_temp.vc('Vxf', 'C1-000002', 10, 12, 60, 3), '{pagos}', '[{"medio":"qr","monto":60,"verificado":false}]'))$$,
  'ERP_DATOS_INVALIDOS', 'QR sin confirmar en línea');
select is((select count(*) from public.ventas where id in (select pg_temp.i(x) from unnest(array['Vx1','Vx2','Vx3','Vx4','Vx5','Vx6','Vx7','Vx8','Vx9','Vxa','Vxb','Vxc','Vxd','Vxe','Vxf']) x)),
  0::bigint, 'ningún rechazo dejó una venta');
-- una venta de contado no admite la lista crédito
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vy1', 'C1-000002', 10, 12, 120, 3) - 'condicion' - 'credito')$$, 'ERP_DATOS_INVALIDOS', 'lista crédito sin condición de crédito');
-- QR como inicial, confirmado
select is(public.registrar_venta(jsonb_set(pg_temp.vc('V2', 'C1-000002', 5, 12, 30, 2), '{pagos}', '[{"medio":"qr","monto":30,"verificado":true}]')) ->> 'numero',
  'C1-000002', 'V2: inicial 30 por QR confirmado, 2 cuotas');
select is((select count(*) from public.credito_cuotas where credito_id = pg_temp.cred('V2')), 2::bigint, 'V2: dos cuotas');

-- Piso de precios en la lista crédito (PF: crédito 12, mínimo 11 → piso 11). e no puede bajar del piso sin `descontar`.
reset role;
delete from public.rol_permisos where tipo_negocio = 'tienda' and rol = 'encargado' and permiso = 'descontar';
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vp1', 'C1-000003', 10, 10.5, 56, 3, 'PF'))$$, 'ERP_SIN_PERMISO', 'piso: bajo el mínimo sin descontar');
select is(public.registrar_venta(pg_temp.vc('Vp2', 'C1-000003', 10, 11, 55, 3, 'PF')) ->> 'numero', 'C1-000003', 'piso: en el mínimo se vende');
select is((select precio_lista_servidor from public.venta_items where venta_id = pg_temp.i('Vp2')), 12.00, 'se guarda el precio de la lista crédito');
reset role;
insert into public.rol_permisos (tipo_negocio, rol, permiso) values ('tienda', 'encargado', 'descontar');
select pg_temp.como(pg_temp.i('d'));
-- tope 10 %: base = 11 x 10 = 110; descontar bajo el piso hasta 11 de brecha
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vp3', 'C1-000004', 10, 9, 45, 3, 'PF'))$$, 'ERP_DESCUENTO_TOPE', 'piso: la brecha supera el tope');
select is(public.registrar_venta(pg_temp.vc('Vp4', 'C1-000004', 10, 10, 50, 3, 'PF')) ->> 'numero', 'C1-000004', 'piso: con descontar y dentro del tope');

-- Permisos de la venta a crédito: el vendedor no la crea; la lavandería tampoco
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vz1', 'C1-000005', 10, 12, 60, 3))$$, 'ERP_SIN_PERMISO', 'vendedor no vende a crédito');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.registrar_venta(jsonb_build_object('id', pg_temp.i('Vz2'), 'dispositivo_id', pg_temp.i('DL'), 'caja_sesion_id', pg_temp.i('SL'),
  'numero', 'L1-000001', 'creada_en_cliente', now(), 'cliente_id', pg_temp.i('CLL'), 'total', 120, 'condicion', 'credito',
  'credito', jsonb_build_object('cuotas', 3, 'docs_ci', true, 'docs_domicilio', true, 'docs_pagare', true),
  'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('PL'), 'lista', 'credito', 'cantidad', 10, 'precio_unitario', 12)),
  'pagos', jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', 60))))$$, 'ERP_SIN_PERMISO', 'lavandería no vende a crédito (matriz)');

-- Anular y devolver una venta con crédito
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select public.anular_venta(pg_temp.i('V1'), 'error')$$, 'ERP_VENTA_CON_CREDITO', 'anular una venta con crédito');
select throws_ok($$select public.devolver_venta(jsonb_build_object('id', pg_temp.i('Dv1'), 'venta_id', pg_temp.i('V1'), 'dispositivo_id', pg_temp.i('D1'),
  'caja_sesion_id', pg_temp.i('S1'), 'medio', 'efectivo', 'motivo', 'x',
  'items', jsonb_build_array(jsonb_build_object('venta_item_id', (select id from public.venta_items where venta_id = pg_temp.i('V1')), 'cantidad', 1))))$$,
  'ERP_VENTA_CON_CREDITO', 'devolver una venta con crédito');
select is((select estado from public.ventas where id = pg_temp.i('V1')), 'completada', 'la venta con crédito sigue completada');

-- Parámetros guardados: se usan y quedan auditados
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select public.guardar_credito_config(pg_temp.i('T'), 30, 4, 6, 0)$$, 'e guarda 30 % / 4 cuotas / máx 6 / sin interés');
select is((select to_jsonb(p) from public.credito_parametros(pg_temp.i('T')) p),
  '{"inicial_pct":30.00,"plazo_cuotas":4,"max_cuotas":6,"interes_mensual_pct":0.00}'::jsonb, 'parámetros guardados');
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vc1', 'C1-000006', 10, 12, 35.99, 3))$$, 'ERP_INICIAL_INSUFICIENTE', 'mínimo 30 %: 35,99 de 120');
select throws_ok($$select public.registrar_venta(pg_temp.vc('Vc2', 'C1-000006', 10, 12, 36, 7))$$, 'ERP_DATOS_INVALIDOS', 'máximo 6 cuotas');
select is(public.registrar_venta(pg_temp.vc('V3', 'C1-000006', 10, 12, 36, 4)) ->> 'numero', 'C1-000006', 'V3: 30 % de inicial y 4 cuotas');
select is((select array_agg(capital + interes order by numero) from public.credito_cuotas where credito_id = pg_temp.cred('V3')), array[21.00, 21.00, 21.00, 21.00],
  'V3: sin interés, 84 / 4');
reset role;
select is((select count(*) from public.auditoria where tabla = 'credito_config' and negocio_id = pg_temp.i('T')), 1::bigint, 'el cambio de parámetros queda en auditoria');
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select public.guardar_credito_config(pg_temp.i('T'), 50, 3, 12, 2.5)$$, 'vuelven los valores por defecto');

-- DB-22 / pagar_cuota sobre V1 (saldo 63,02; cuotas 21,01 / 21,01 / 21,00). Cobra v (vendedor, permiso caja) en S1.
select pg_temp.como(pg_temp.i('v'));
select is((select public.pagar_cuota(jsonb_build_object('id', pg_temp.i('Q1'), 'credito_id', pg_temp.cred('V1'), 'dispositivo_id', pg_temp.i('D1'),
  'caja_sesion_id', pg_temp.i('S1'), 'efectivo', 10, 'qr', 0))), jsonb_build_object('id', pg_temp.i('Q1'), 'saldo', 53.02), 'DB-22: pago parcial de 10');
select is((select count(*) from public.credito_pagos where credito_id = pg_temp.cred('V1')), 1::bigint, 'una fila de pago');
select is((select estado from public.creditos where id = pg_temp.cred('V1')), 'activo', 'sigue activo');
select is((public.detalle_credito(pg_temp.cred('V1')) -> 'cuotas' -> 0 ->> 'pagado')::numeric, 10.00, 'FIFO: el pago cae en la cuota 1');
select is((public.detalle_credito(pg_temp.cred('V1')) -> 'cuotas' -> 0 ->> 'pendiente')::numeric, 11.01, 'FIFO: pendiente de la cuota 1');
select is((public.detalle_credito(pg_temp.cred('V1')) -> 'cuotas' -> 1 ->> 'pagado')::numeric, 0.00, 'FIFO: la cuota 2 no se toca');
-- idempotencia
select is((select public.pagar_cuota(jsonb_build_object('id', pg_temp.i('Q1'), 'credito_id', pg_temp.cred('V1'), 'dispositivo_id', pg_temp.i('D1'),
  'caja_sesion_id', pg_temp.i('S1'), 'efectivo', 10, 'qr', 0))) ->> 'id', pg_temp.i('Q1')::text, 'reintento: devuelve el mismo id');
select ok(public.pagar_cuota(jsonb_build_object('id', pg_temp.i('Q1'), 'credito_id', pg_temp.cred('V1'), 'dispositivo_id', pg_temp.i('D1'),
  'caja_sesion_id', pg_temp.i('S1'), 'efectivo', 10, 'qr', 0)) ? 'saldo', 'reintento: la misma forma que la primera respuesta (con saldo)');
select is((select count(*) from public.credito_pagos where credito_id = pg_temp.cred('V1')), 1::bigint, 'reintento: sin pago duplicado');
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 11, 'qr', 0))$$,
  pg_temp.i('Q1'), pg_temp.cred('V1'), pg_temp.i('D1'), pg_temp.i('S1')), 'ERP_OPERACION_REPETIDA', 'mismo id con otro monto');
-- pago mixto: 11,01 = 6,01 efectivo + 5 QR cierra la cuota 1
select is((select public.pagar_cuota(jsonb_build_object('id', pg_temp.i('Q2'), 'credito_id', pg_temp.cred('V1'), 'dispositivo_id', pg_temp.i('D1'),
  'caja_sesion_id', pg_temp.i('S1'), 'efectivo', 6.01, 'qr', 5))) ->> 'saldo', '42.01', 'pago mixto efectivo + QR');
select is((select count(*) from public.credito_pagos where operacion_id = pg_temp.i('Q2')), 2::bigint, 'el pago mixto escribe una fila por medio');
select is((public.detalle_credito(pg_temp.cred('V1')) -> 'cuotas' -> 0 ->> 'pendiente')::numeric, 0.00, 'FIFO: la cuota 1 queda pagada');
-- sobrepago
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 42.02, 'qr', 0))$$,
  pg_temp.i('Q3'), pg_temp.cred('V1'), pg_temp.i('D1'), pg_temp.i('S1')), 'ERP_PAGO_EXCEDE_SALDO', 'DB-22: pagar de más se rechaza');
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 40, 'qr', 2.02))$$,
  pg_temp.i('Q3'), pg_temp.cred('V1'), pg_temp.i('D1'), pg_temp.i('S1')), 'ERP_PAGO_EXCEDE_SALDO', 'DB-22: pagar de más con efectivo y QR');
select is(pg_temp.saldo(pg_temp.cred('V1')), 42.01, 'el rechazo no cambió el saldo');
-- validaciones
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 0, 'qr', 0))$$,
  pg_temp.i('Q4'), pg_temp.cred('V1'), pg_temp.i('D1'), pg_temp.i('S1')), 'ERP_DATOS_INVALIDOS', 'pago en cero');
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 1.005, 'qr', 0))$$,
  pg_temp.i('Q4'), pg_temp.cred('V1'), pg_temp.i('D1'), pg_temp.i('S1')), 'ERP_DATOS_INVALIDOS', 'monto con más de 2 decimales');
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 1, 'qr', 0, 'x', 1))$$,
  pg_temp.i('Q4'), pg_temp.cred('V1'), pg_temp.i('D1'), pg_temp.i('S1')), 'ERP_DATOS_INVALIDOS', 'clave desconocida');
-- equipo ajeno: la sesión S2 es del equipo D2, no de D1
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 1, 'qr', 0))$$,
  pg_temp.i('Q4'), pg_temp.cred('V1'), pg_temp.i('D1'), pg_temp.i('S2')), 'ERP_SIN_PERMISO', 'la sesión de otro equipo se rechaza');
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 1, 'qr', 0))$$,
  pg_temp.i('Q4'), pg_temp.cred('V1'), pg_temp.i('D3'), pg_temp.i('SC')), 'ERP_CAJA_CERRADA', 'sesión cerrada');
select is((select count(*) from public.credito_pagos where operacion_id = pg_temp.i('Q4')), 0::bigint, 'los rechazos no dejaron pagos');
-- la sesión S2 de D2 sí cobra (otro cajero)
select is((select public.pagar_cuota(jsonb_build_object('id', pg_temp.i('Q5'), 'credito_id', pg_temp.cred('V1'), 'dispositivo_id', pg_temp.i('D2'),
  'caja_sesion_id', pg_temp.i('S2'), 'efectivo', 2, 'qr', 0))) ->> 'saldo', '40.01', 'otro equipo cobra en su propia sesión');

-- Arqueo (v no tiene ver_reportes: sus términos van en null)
select is(pg_temp.res_caja('S1', 'esperado'), null, 'arqueo: sin ver_reportes el esperado va en null');
select is(pg_temp.res_caja('S1', 'cuotas_efectivo'), null, 'arqueo: cuotas_efectivo en null sin ver_reportes');
select is(pg_temp.res_caja('S1', 'cuotas_qr'), null, 'arqueo: cuotas_qr en null sin ver_reportes');
select pg_temp.como(pg_temp.i('e'));
-- S1: inicial 100 + inicial V1 60 + V3 inicial 36 + Vp2 55 + Vp4 50 (efectivo) + cuotas 10 + 6,01 = 317,01; QR de V2 30 y cuota 5
select is(pg_temp.res_caja('S1', 'cuotas_efectivo'), 16.01, 'arqueo: cuotas en efectivo de S1');
select is(pg_temp.res_caja('S1', 'cuotas_qr'), 5.00, 'arqueo: cuotas por QR de S1');
select is(pg_temp.res_caja('S1', 'ventas_efectivo'), 60 + 55 + 50 + 36::numeric, 'arqueo: las iniciales entran como ventas en efectivo');
select is(pg_temp.res_caja('S1', 'esperado'), 100 + 60 + 55 + 50 + 36 + 16.01, 'DB-22 arqueo: esperado = inicial + iniciales + cuotas en efectivo');
select is(pg_temp.res_caja('S1', 'qr_neto'), 30 + 5.00, 'arqueo: QR neto = inicial por QR + cuota por QR');
select is(pg_temp.res_caja('S2', 'cuotas_efectivo'), 2.00, 'arqueo: la cuota cobrada en S2 va a S2');
select is(pg_temp.res_caja('S2', 'esperado'), 2.00, 'arqueo: esperado de S2');
select is(pg_temp.res_caja('S1', 'esperado'),
  pg_temp.res_caja('S1', 'monto_inicial') + pg_temp.res_caja('S1', 'ventas_efectivo') + pg_temp.res_caja('S1', 'ingresos') - pg_temp.res_caja('S1', 'gastos')
  - pg_temp.res_caja('S1', 'retiros') - pg_temp.res_caja('S1', 'devoluciones_efectivo') + pg_temp.res_caja('S1', 'anticipos_efectivo')
  - pg_temp.res_caja('S1', 'devoluciones_reserva_efectivo') + pg_temp.res_caja('S1', 'cuotas_efectivo'), 'el desglose del resumen suma el esperado');
select pg_temp.como(pg_temp.i('d'));
select is((select f ->> 'cuotas_efectivo' from jsonb_array_elements(public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'filas') f
  where f ->> 'sesion_id' = pg_temp.i('S1')::text), '16.01', 'reporte_caja: cuotas_efectivo por sesión');
select is((public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'totales' ->> 'cuotas_efectivo')::numeric, 18.01, 'reporte_caja: total de cuotas en efectivo');
select is((select (f ->> 'monto_inicial')::numeric + (f ->> 'ventas_efectivo')::numeric + (f ->> 'ingresos')::numeric - (f ->> 'egresos')::numeric
    - (f ->> 'devoluciones_efectivo')::numeric + (f ->> 'reservas_efectivo')::numeric + (f ->> 'cuotas_efectivo')::numeric
  from jsonb_array_elements(public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'filas') f where f ->> 'sesion_id' = pg_temp.i('S1')::text),
  (select (f ->> 'esperado')::numeric from jsonb_array_elements(public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'filas') f
   where f ->> 'sesion_id' = pg_temp.i('S1')::text), 'reporte_caja: las columnas suman el esperado');

-- Pago total: cierra el crédito
select pg_temp.como(pg_temp.i('v'));
select is((select public.pagar_cuota(jsonb_build_object('id', pg_temp.i('Q6'), 'credito_id', pg_temp.cred('V1'), 'dispositivo_id', pg_temp.i('D1'),
  'caja_sesion_id', pg_temp.i('S1'), 'efectivo', 40.01, 'qr', 0))) ->> 'saldo', '0.00', 'DB-22: pago total, saldo cero');
select is((select estado from public.creditos where id = pg_temp.cred('V1')), 'pagado', 'el crédito queda pagado');
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 0.01, 'qr', 0))$$,
  pg_temp.i('Q7'), pg_temp.cred('V1'), pg_temp.i('D1'), pg_temp.i('S1')), 'ERP_PAGO_EXCEDE_SALDO', 'un crédito pagado no admite más pagos');
select is((select count(*) from public.cuentas_por_cobrar(pg_temp.i('T'), pg_temp.i('CL')) where credito_id = pg_temp.cred('V1')), 0::bigint, 'un crédito pagado sale de las cuentas por cobrar');

-- Permisos de cobro y lectura
select pg_temp.como(pg_temp.i('c'));
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 1, 'qr', 0))$$,
  pg_temp.i('Q8'), pg_temp.cred('V3'), pg_temp.i('D1'), pg_temp.i('S1')), 'ERP_SIN_PERMISO', 'contador no cobra (sin caja)');
select pg_temp.como(pg_temp.i('y'));
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 1, 'qr', 0))$$,
  pg_temp.i('Q8'), pg_temp.cred('V3'), pg_temp.i('DX'), pg_temp.i('SX')), 'ERP_SIN_PERMISO', 'otro negocio no cobra el crédito ajeno con su sesión');
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 1, 'qr', 0))$$,
  pg_temp.i('Q8'), pg_temp.cred('V3'), pg_temp.i('D1'), pg_temp.i('S1')), 'ERP_SIN_PERMISO', 'otro negocio no usa la sesión ajena');
select throws_ok($$select * from public.cuentas_por_cobrar(pg_temp.i('T'))$$, 'ERP_SIN_PERMISO', 'otro negocio no lee las cuentas');
select throws_ok(format($$select public.detalle_credito(%L)$$, pg_temp.cred('V3')), 'ERP_SIN_PERMISO', 'otro negocio no lee el detalle');
select is((select count(*) from public.creditos), 0::bigint, 'RLS: otro negocio no ve créditos');
select is((select count(*) from public.credito_cuotas) + (select count(*) from public.credito_pagos), 0::bigint, 'RLS: ni cuotas ni pagos');
select is((select count(*) from public.credito_config), 0::bigint, 'RLS: ni parámetros');
select pg_temp.como(pg_temp.i('c'));
select ok((select count(*) from public.creditos) > 0, 'RLS: el contador ve los créditos de su negocio');
select throws_ok($$update public.creditos set estado = 'anulado'$$, '42501', null, 'sin escritura directa en creditos');
select throws_ok($$insert into public.credito_pagos (negocio_id, credito_id, operacion_id, monto, medio, caja_sesion_id) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1, 'efectivo', gen_random_uuid())$$,
  '42501', null, 'sin escritura directa en credito_pagos');

-- Saldo inicial (RF-CRE-06): 300 en 3 cuotas desde hace 40 días; sin venta ni caja
select pg_temp.como(pg_temp.i('v'));
select throws_ok(format($$select public.crear_credito_inicial(%L, %L, %L, 300, 3, %L)$$, pg_temp.i('K1'), pg_temp.i('T'), pg_temp.i('CL2'), pg_temp.hoy() - 40),
  'ERP_SIN_PERMISO', 'vendedor no carga saldos iniciales');
select pg_temp.como(pg_temp.i('x'));
select throws_ok(format($$select public.crear_credito_inicial(%L, %L, %L, 300, 3, %L)$$, pg_temp.i('K1'), pg_temp.i('L'), pg_temp.i('CLL'), pg_temp.hoy() - 40),
  'ERP_SIN_PERMISO', 'lavandería no carga saldos iniciales (matriz)');
select pg_temp.como(pg_temp.i('y'));
select throws_ok(format($$select public.crear_credito_inicial(%L, %L, %L, 300, 3, %L)$$, pg_temp.i('K1'), pg_temp.i('T'), pg_temp.i('CL2'), pg_temp.hoy() - 40),
  'ERP_SIN_PERMISO', 'otro negocio no carga saldos');
select pg_temp.como(pg_temp.i('e'));
select throws_ok(format($$select public.crear_credito_inicial(%L, %L, %L, 300, 3, %L)$$, pg_temp.i('K1'), pg_temp.i('T'), pg_temp.i('CLX'), pg_temp.hoy() - 40),
  'ERP_DATOS_INVALIDOS', 'saldo inicial: cliente de otro negocio');
select throws_ok(format($$select public.crear_credito_inicial(%L, %L, %L, 0, 3, %L)$$, pg_temp.i('K1'), pg_temp.i('T'), pg_temp.i('CL2'), pg_temp.hoy() - 40),
  'ERP_DATOS_INVALIDOS', 'saldo inicial: capital cero');
select throws_ok(format($$select public.crear_credito_inicial(%L, %L, %L, 300, 0, %L)$$, pg_temp.i('K1'), pg_temp.i('T'), pg_temp.i('CL2'), pg_temp.hoy() - 40),
  'ERP_DATOS_INVALIDOS', 'saldo inicial: cero cuotas');
select throws_ok(format($$select public.crear_credito_inicial(%L, %L, %L, 300, 3, %L)$$, pg_temp.i('K1'), pg_temp.i('T'), pg_temp.i('CL2'), pg_temp.hoy() + 400),
  'ERP_DATOS_INVALIDOS', 'saldo inicial: primera cuota demasiado lejana');
select is(public.crear_credito_inicial(pg_temp.i('K1'), pg_temp.i('T'), pg_temp.i('CL2'), 300, 3, pg_temp.hoy() - 40), jsonb_build_object('id', pg_temp.i('K1')), 'K1 creado');
select is(public.crear_credito_inicial(pg_temp.i('K1'), pg_temp.i('T'), pg_temp.i('CL2'), 300, 3, pg_temp.hoy() - 40), jsonb_build_object('id', pg_temp.i('K1')), 'K1 idempotente');
select is((select count(*) from public.creditos where id = pg_temp.i('K1')), 1::bigint, 'K1: un solo crédito');
select throws_ok(format($$select public.crear_credito_inicial(%L, %L, %L, 301, 3, %L)$$, pg_temp.i('K1'), pg_temp.i('T'), pg_temp.i('CL2'), pg_temp.hoy() - 40),
  'ERP_OPERACION_REPETIDA', 'K1 con otro capital');
select is((select origen || '/' || coalesce(venta_id::text, 'sin venta') || '/' || capital || '/' || inicial || '/' || interes_mensual_pct from public.creditos where id = pg_temp.i('K1')),
  'saldo_inicial/sin venta/300.00/0.00/0.00', 'K1: saldo inicial sin venta ni interés');
select is((select array_agg(capital + interes order by numero) from public.credito_cuotas where credito_id = pg_temp.i('K1')), array[100.00, 100.00, 100.00], 'K1: tres cuotas de 100');
select is((select array_agg(vence_en order by numero) from public.credito_cuotas where credito_id = pg_temp.i('K1')),
  array[pg_temp.hoy() - 40, (pg_temp.hoy() - 40 + interval '1 month')::date, (pg_temp.hoy() - 40 + interval '2 month')::date], 'K1: vencen el mismo día de los meses siguientes');
reset role;
select is((select count(*) from public.credito_pagos where credito_id = pg_temp.i('K1')), 0::bigint, 'K1: nada pasó por caja');
select pg_temp.como(pg_temp.i('e'));
-- fin de mes: 31 de enero → 28 de febrero → 31 de marzo (nunca después)
select is(public.crear_credito_inicial(pg_temp.i('K2'), pg_temp.i('T'), pg_temp.i('CL'), 90, 4, date '2026-01-31'), jsonb_build_object('id', pg_temp.i('K2')), 'K2 creado');
select is((select array_agg(vence_en order by numero) from public.credito_cuotas where credito_id = pg_temp.i('K2')),
  array[date '2026-01-31', date '2026-02-28', date '2026-03-31', date '2026-04-30'], 'fin de mes: último día cuando el mes es más corto');

-- FIFO y vencidas (K1: cuota 1 vencida hace 40 días, cuota 2 hace ~10, cuota 3 futura). Cobra v en S1.
select pg_temp.como(pg_temp.i('v'));
select is((select public.pagar_cuota(jsonb_build_object('id', pg_temp.i('Q9'), 'credito_id', pg_temp.i('K1'), 'dispositivo_id', pg_temp.i('D1'),
  'caja_sesion_id', pg_temp.i('S1'), 'efectivo', 150, 'qr', 0))) ->> 'saldo', '150.00', 'K1: pago de 150');
select pg_temp.como(pg_temp.i('e'));
select is((select cuotas_vencidas from public.cuentas_por_cobrar(pg_temp.i('T')) where credito_id = pg_temp.i('K1')), 1, 'FIFO: queda una cuota vencida (la 2, a medias)');
select is((select monto_vencido from public.cuentas_por_cobrar(pg_temp.i('T')) where credito_id = pg_temp.i('K1')), 50.00, 'FIFO: vencido = 50 pendientes de la cuota 2');
select is((select dias_atraso from public.cuentas_por_cobrar(pg_temp.i('T')) where credito_id = pg_temp.i('K1')),
  (pg_temp.hoy() - (pg_temp.hoy() - 40 + interval '1 month')::date), 'días de atraso = hoy menos el vencimiento de la cuota impaga más vieja');
select is((select saldo from public.cuentas_por_cobrar(pg_temp.i('T')) where credito_id = pg_temp.i('K1')), 150.00, 'K1: saldo 150');
select is((select proxima_vence from public.cuentas_por_cobrar(pg_temp.i('T')) where credito_id = pg_temp.i('K1')),
  (pg_temp.hoy() - 40 + interval '1 month')::date, 'próxima = la cuota 2 (impaga más vieja)');
select is((select proxima_monto from public.cuentas_por_cobrar(pg_temp.i('T')) where credito_id = pg_temp.i('K1')), 50.00, 'próxima cuota: lo que falta de la cuota 2');
select is((select count(*) from public.cuentas_por_cobrar(pg_temp.i('T')) where credito_id = pg_temp.cred('V3')), 1::bigint, 'V3 en cuentas por cobrar');
select is((select cuotas_vencidas from public.cuentas_por_cobrar(pg_temp.i('T')) where credito_id = pg_temp.cred('V3')), 0, 'V3: ninguna vencida');
select is((select dias_atraso from public.cuentas_por_cobrar(pg_temp.i('T')) where credito_id = pg_temp.cred('V3')), 0, 'V3: sin atraso');
select is((select venta_numero from public.cuentas_por_cobrar(pg_temp.i('T')) where credito_id = pg_temp.cred('V3')), 'C1-000006', 'V3: número de la venta');
select is((select count(*) from public.cuentas_por_cobrar(pg_temp.i('T'), pg_temp.i('CL2'))), 1::bigint, 'filtrar por cliente: CL2 solo tiene K1');
select is((select count(distinct cliente_id) from public.cuentas_por_cobrar(pg_temp.i('T'))), 2::bigint, 'dos clientes con saldo');
-- lectura: contador sin cliente sí; vendedor solo con cliente
select pg_temp.como(pg_temp.i('c'));
select ok((select count(*) from public.cuentas_por_cobrar(pg_temp.i('T'))) >= 3, 'contador lee todas las cuentas (ver_reportes)');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select * from public.cuentas_por_cobrar(pg_temp.i('T'))$$, 'ERP_SIN_PERMISO', 'vendedor no lista todas las cuentas');
select is((select count(*) from public.cuentas_por_cobrar(pg_temp.i('T'), pg_temp.i('CL2'))), 1::bigint, 'vendedor ve los créditos de un cliente (para cobrar)');
select is(public.detalle_credito(null, pg_temp.i('V3')) ->> 'venta_numero', 'C1-000006', 'detalle por venta');
select is(jsonb_array_length(public.detalle_credito(pg_temp.i('K1')) -> 'cuotas'), 3, 'detalle: tres cuotas');
select is(jsonb_array_length(public.detalle_credito(pg_temp.i('K1')) -> 'pagos'), 1, 'detalle: un pago');
select is((public.detalle_credito(pg_temp.i('K1')) ->> 'saldo')::numeric, 150.00, 'detalle: saldo');
select throws_ok($$select public.detalle_credito(gen_random_uuid())$$, 'ERP_SIN_PERMISO', 'detalle de un crédito inexistente');


-- Revisión: simular_credito (la pantalla no recalcula), anular saldo inicial, paginación SQL, cuotas fuera de rango, reporte QR
select pg_temp.como(pg_temp.i('e'));
select is((public.simular_credito(pg_temp.i('T'), 120, null, null) - 'plan'),
  '{"error":null,"minimo":60.00,"inicial":60.00,"cuotas":3,"financiado":60.00,"max_cuotas":12,"inicial_pct":50.00}'::jsonb, 'simular: valores por defecto');
select is((select array_agg((e ->> 'monto')::numeric order by (e ->> 'numero')::int) from jsonb_array_elements(public.simular_credito(pg_temp.i('T'), 120, 60, 3) -> 'plan') e),
  array[21.01, 21.01, 21.00], 'simular: el mismo plan que registrar_venta');
select is((select array_agg((e ->> 'vence_en')::date order by (e ->> 'numero')::int) from jsonb_array_elements(public.simular_credito(pg_temp.i('T'), 120, 60, 3) -> 'plan') e),
  (select array_agg(vence_en order by numero) from public.credito_cuotas where credito_id = pg_temp.cred('V1')), 'simular: los mismos vencimientos que el crédito real');
select is(public.simular_credito(pg_temp.i('T'), 120, 59.99, 3) ->> 'error', 'ERP_INICIAL_INSUFICIENTE', 'simular: inicial bajo el mínimo');
select is(public.simular_credito(pg_temp.i('T'), 120, 120, 3) ->> 'error', 'ERP_DATOS_INVALIDOS', 'simular: inicial igual al total');
select is(public.simular_credito(pg_temp.i('T'), 120, 60, 13) ->> 'error', 'ERP_DATOS_INVALIDOS', 'simular: más cuotas que el máximo');
select is(public.simular_credito(pg_temp.i('T'), 120, 119.99, 3) ->> 'error', 'ERP_DATOS_INVALIDOS', 'simular: saldo muy chico para tantas cuotas');
select is(jsonb_array_length(public.simular_credito(pg_temp.i('T'), 120, 59, 3) -> 'plan'), 0, 'simular: con error no hay plan');
select throws_ok($$select public.simular_credito(pg_temp.i('T'), 0, null, null)$$, 'ERP_DATOS_INVALIDOS', 'simular: total cero');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.simular_credito(pg_temp.i('T'), 120, null, null)$$, 'ERP_SIN_PERMISO', 'simular: vendedor no');
select pg_temp.como(pg_temp.i('y'));
select throws_ok($$select public.simular_credito(pg_temp.i('T'), 120, null, null)$$, 'ERP_SIN_PERMISO', 'simular: otro negocio no');

-- cuotas fuera de rango o no enteras
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select public.registrar_venta(jsonb_set(pg_temp.vc('Vr1', 'C1-000007', 10, 12, 60, 3), '{credito,cuotas}', '1000000000000'))$$, 'ERP_DATOS_INVALIDOS', 'cuotas fuera del rango de integer');
select throws_ok($$select public.registrar_venta(jsonb_set(pg_temp.vc('Vr2', 'C1-000007', 10, 12, 60, 3), '{credito,cuotas}', '2.5'))$$, 'ERP_DATOS_INVALIDOS', 'cuotas no entera');
select throws_ok($$select public.registrar_venta(jsonb_set(pg_temp.vc('Vr3', 'C1-000007', 10, 12, 60, 3), '{credito,cuotas}', '"3"'))$$, 'ERP_DATOS_INVALIDOS', 'cuotas como texto');
select throws_ok($$select public.guardar_credito_config(pg_temp.i('T'), 0, 3, 12, 2.5)$$, 'ERP_DATOS_INVALIDOS', 'inicial 0 %');

-- anular saldo inicial
select is(public.crear_credito_inicial(pg_temp.i('K3'), pg_temp.i('T'), pg_temp.i('CL'), 50, 2, pg_temp.hoy()), jsonb_build_object('id', pg_temp.i('K3')), 'K3 creado');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.anular_credito_inicial(pg_temp.i('A1'), pg_temp.i('K3'), 'error de carga')$$, 'ERP_SIN_PERMISO', 'vendedor no anula');
select pg_temp.como(pg_temp.i('y'));
select throws_ok($$select public.anular_credito_inicial(pg_temp.i('A1'), pg_temp.i('K3'), 'error de carga')$$, 'ERP_SIN_PERMISO', 'otro negocio no anula');
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select public.anular_credito_inicial(pg_temp.i('A1'), pg_temp.i('K3'), '  ')$$, 'ERP_DATOS_INVALIDOS', 'anular exige motivo');
select throws_ok($$select public.anular_credito_inicial(pg_temp.i('A1'), pg_temp.cred('V3'), 'x')$$, 'ERP_DATOS_INVALIDOS', 'un crédito de venta no se anula así');
select throws_ok($$select public.anular_credito_inicial(pg_temp.i('A1'), pg_temp.i('K1'), 'x')$$, 'ERP_CREDITO_CON_PAGOS', 'con pagos no se anula');
select is(public.anular_credito_inicial(pg_temp.i('A2'), pg_temp.i('K3'), 'error de carga'), jsonb_build_object('id', pg_temp.i('K3'), 'estado', 'anulado'), 'K3 anulado');
select is(public.anular_credito_inicial(pg_temp.i('A2'), pg_temp.i('K3'), 'error de carga'), jsonb_build_object('id', pg_temp.i('K3'), 'estado', 'anulado'), 'anular es idempotente');
select throws_ok($$select public.anular_credito_inicial(pg_temp.i('A2'), pg_temp.i('K3'), 'otro motivo')$$, 'ERP_OPERACION_REPETIDA', 'misma operación con otro motivo');
select throws_ok($$select public.anular_credito_inicial(pg_temp.i('A3'), pg_temp.i('K3'), 'otra vez')$$, 'ERP_CREDITO_CON_PAGOS', 'un crédito anulado no se anula de nuevo');
select is((select estado || '/' || motivo_anulacion || '/' || (anulado_por = pg_temp.i('e'))::text || '/' || (anulado_en is not null)::text from public.creditos where id = pg_temp.i('K3')),
  'anulado/error de carga/true/true', 'quedan estado, motivo, quién y cuándo');
select is((select count(*) from public.cuentas_por_cobrar(pg_temp.i('T')) where credito_id = pg_temp.i('K3')), 0::bigint, 'el anulado sale de las cuentas por cobrar');
select throws_ok(format($$select public.pagar_cuota(jsonb_build_object('id', %L, 'credito_id', %L, 'dispositivo_id', %L, 'caja_sesion_id', %L, 'efectivo', 1, 'qr', 0))$$,
  pg_temp.i('Q10'), pg_temp.i('K3'), pg_temp.i('D1'), pg_temp.i('S1')), 'ERP_PAGO_EXCEDE_SALDO', 'no se cobra un crédito anulado');
reset role;
select throws_ok($$update public.credito_pagos set monto = 1$$, null, null, 'sigue siendo append-only');

-- Paginación en SQL: la unidad es el cliente (con todos sus créditos); CL (K2, de enero) es el más atrasado
select pg_temp.como(pg_temp.i('e'));
select is((select array_agg(distinct cliente_id) from public.cuentas_por_cobrar(pg_temp.i('T'), null, false, 1, 0)), array[pg_temp.i('CL')], 'página 1 de 1 cliente: el más atrasado');
select is((select max(total_filas) from public.cuentas_por_cobrar(pg_temp.i('T'), null, false, 1, 0)), 2::bigint, 'total_filas = clientes con saldo');
select is((select array_agg(distinct cliente_id) from public.cuentas_por_cobrar(pg_temp.i('T'), null, false, 1, 1)), array[pg_temp.i('CL2')], 'página 2: el otro cliente');
select ok((select count(*) from public.cuentas_por_cobrar(pg_temp.i('T'), null, false, 1, 0)) >= 3, 'la página trae todos los créditos del cliente');
select is((select count(*) from public.cuentas_por_cobrar(pg_temp.i('T'), null, false, 1, 2)), 0::bigint, 'más allá de la última página: vacío');
select is((select array_agg(credito_id order by dias_atraso desc) from public.cuentas_por_cobrar(pg_temp.i('T'), null, true, 1, 0)), array[pg_temp.i('K2')], 'vencidas: el más atrasado primero (K2 de enero)');
select is((select max(total_filas) from public.cuentas_por_cobrar(pg_temp.i('T'), null, true, 1, 0)), 2::bigint, 'vencidas: total de créditos vencidos');
select throws_ok($$select * from public.cuentas_por_cobrar(pg_temp.i('T'), null, false, 0, 0)$$, 'ERP_DATOS_INVALIDOS', 'límite cero');
select throws_ok($$select * from public.cuentas_por_cobrar(pg_temp.i('T'), null, false, 201, 0)$$, 'ERP_DATOS_INVALIDOS', 'límite sobre el tope');
select throws_ok($$select * from public.cuentas_por_cobrar(pg_temp.i('T'), null, false, 10, -1)$$, 'ERP_DATOS_INVALIDOS', 'offset negativo');
select is((select count(*) from public.cuentas_por_cobrar(pg_temp.i('T'), pg_temp.i('CL'), false, 1, 5)), (select count(*) from public.cuentas_por_cobrar(pg_temp.i('T'), pg_temp.i('CL'))),
  'con cliente no hay página ni tope');

-- reporte_caja: ventas_qr es solo QR de ventas; las cuotas y las reservas tienen su columna
select pg_temp.como(pg_temp.i('d'));
select is((select f ->> 'ventas_qr' || '/' || (f ->> 'cuotas_qr') || '/' || (f ->> 'reservas_qr') from jsonb_array_elements(public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'filas') f
  where f ->> 'sesion_id' = pg_temp.i('S1')::text), '30.00/5.00/0', 'S1: ventas_qr sin la cuota por QR, cuotas_qr aparte');
select is((public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'totales' ->> 'cuotas_qr')::numeric, 5.00, 'totales: cuotas_qr');
select is((public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'totales' ->> 'ventas_qr')::numeric, 30.00, 'totales: ventas_qr');

-- Append-only y sin borrar
reset role;
select throws_ok($$update public.credito_pagos set monto = 1$$, null, null, 'credito_pagos es append-only');
select throws_ok($$delete from public.credito_cuotas$$, null, null, 'credito_cuotas no se borra');
select throws_ok($$update public.credito_cuotas set capital = 1$$, null, null, 'credito_cuotas no se edita');
select throws_ok($$delete from public.creditos$$, null, null, 'creditos no se borra');

select * from finish();
rollback;
